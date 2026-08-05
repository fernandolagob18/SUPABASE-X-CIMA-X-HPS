/**
 * BlisterCheck — Sincronización del Catálogo de Medicamentos Comercializados
 *
 * Ejecutado por GitHub Actions cada 14 días (días 1 y 15 del mes a las 04:00 UTC).
 *
 * Estrategia de seguridad:
 * - 3 reintentos con backoff exponencial antes de rendirse
 * - Si la API falla o devuelve 0 resultados → aborta SIN tocar Supabase
 * - La tabla blistercheck_clasificacion NUNCA es modificada por este script
 * - Usa UPSERT (no DELETE+INSERT) para actualizar el catálogo de forma segura
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CIMA_API_BASE = 'https://cima.aemps.es/cima/rest';
const PAGE_SIZE = 200;
const CONCURRENCY_LIMIT = 5;
const UPSERT_BATCH_SIZE = 500;

// ─── Helper: fetch con reintentos y backoff exponencial ───────────────────────
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) {
        throw new Error(`Fallo tras ${maxRetries} intentos: ${err.message}`);
      }
      const waitMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      console.warn(`⚠️  Intento ${attempt}/${maxRetries} fallido: ${err.message}. Reintentando en ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// ─── Obtener todos los medicamentos comercializados de CIMA (para enriquecer metadata) ───
async function fetchAllMedicamentosComercializados() {
  console.log('🔍 Consultando API CIMA — medicamentos comercializados...');
  const cacheBuster = `&t=${Date.now()}`;
  let allResults = [];

  const firstData = await fetchWithRetry(
    `${CIMA_API_BASE}/medicamentos?comerc=1&pagina=1&tamanioPagina=${PAGE_SIZE}${cacheBuster}`
  );

  const totalItems = firstData.totalFilas || 0;
  if (totalItems === 0) {
    throw new Error('La API devolvió 0 medicamentos — posible error del servidor.');
  }

  allResults = firstData.resultados || [];
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  console.log(`📦 Total: ${totalItems} medicamentos en ${totalPages} páginas`);

  if (totalPages > 1) {
    const remainingPages = [];
    for (let i = 2; i <= totalPages; i++) remainingPages.push(i);

    for (let i = 0; i < remainingPages.length; i += CONCURRENCY_LIMIT) {
      const chunk = remainingPages.slice(i, i + CONCURRENCY_LIMIT);
      const chunkResults = await Promise.all(
        chunk.map(async (pageNum) => {
          const data = await fetchWithRetry(
            `${CIMA_API_BASE}/medicamentos?comerc=1&pagina=${pageNum}&tamanioPagina=${PAGE_SIZE}${cacheBuster}`
          );
          return data.resultados || [];
        })
      );
      chunkResults.forEach(r => { allResults = allResults.concat(r); });
      const loaded = Math.min(1 + i + chunk.length, totalPages);
      process.stdout.write(`\r   Páginas cargadas: ${loaded}/${totalPages}`);
    }
    console.log('');
  }

  console.log(`✅ Descargados ${allResults.length} medicamentos de CIMA`);
  return allResults;
}

// ─── Obtener todas las presentaciones comercializadas de CIMA ────────────────
async function fetchAllPresentacionesComercializadas() {
  console.log('🔍 Consultando API CIMA — presentaciones comercializadas...');
  const cacheBuster = `&t=${Date.now()}`;
  let allResults = [];

  // Primera página para obtener el total
  const firstData = await fetchWithRetry(
    `${CIMA_API_BASE}/presentaciones?comerc=1&pagina=1&tamanioPagina=${PAGE_SIZE}${cacheBuster}`
  );

  const totalItems = firstData.totalFilas || 0;

  if (totalItems === 0) {
    throw new Error('La API devolvió 0 presentaciones — posible error del servidor. Abortando para proteger la BD.');
  }

  allResults = firstData.resultados || [];
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  console.log(`📦 Total: ${totalItems} presentaciones en ${totalPages} páginas`);

  // Páginas restantes con concurrencia controlada
  if (totalPages > 1) {
    const remainingPages = [];
    for (let i = 2; i <= totalPages; i++) remainingPages.push(i);

    for (let i = 0; i < remainingPages.length; i += CONCURRENCY_LIMIT) {
      const chunk = remainingPages.slice(i, i + CONCURRENCY_LIMIT);

      const chunkResults = await Promise.all(
        chunk.map(async (pageNum) => {
          const data = await fetchWithRetry(
            `${CIMA_API_BASE}/presentaciones?comerc=1&pagina=${pageNum}&tamanioPagina=${PAGE_SIZE}${cacheBuster}`
          );
          return data.resultados || [];
        })
      );

      chunkResults.forEach(r => { allResults = allResults.concat(r); });

      const loaded = Math.min(1 + i + chunk.length, totalPages);
      process.stdout.write(`\r   Páginas cargadas: ${loaded}/${totalPages}`);
    }
    console.log(''); // Nueva línea tras el progreso
  }

  // Filtrar: solo presentaciones con cn numérico válido y comercializadas (incluyendo envases clínicos)
  const validas = allResults.filter(item =>
    item.cn &&
    item.comerc === true &&
    /^\d{5,9}$/.test(String(item.cn).trim())  // CN debe ser numérico de 5-9 dígitos
  );

  console.log(`✅ Descargadas ${allResults.length} presentaciones → ${validas.length} válidas (comercializadas con CN numérico)`);
  return validas;
}

// ─── Transformar datos de CIMA al formato de Supabase ────────────────────────
//
// Fuente de verdad por campo:
//   CN, nombre envase, fotos, docs  ← /presentaciones   (item)
//   dosis, p.activo, forma, vía     ← /medicamentos     (medPadre, keyed by nregistro)
//
function transformPresentacion(item, medPadre) {
  // ── Fotos y documentos: solo disponibles en /presentaciones ──────────────────
  const fotoEnvase = (item.fotos || []).find(f => f.tipo === 'materialas');
  const fotoForma  = (item.fotos || []).find(f => f.tipo === 'formafarmac');
  const docFT      = (item.docs  || []).find(d => d.tipo === 1);
  const docProspe  = (item.docs  || []).find(d => d.tipo === 2);

  // ── Metadata clínica: fuente autoritativa = /medicamentos (medPadre) ─────────
  // Si por algún motivo no hay medPadre (medicamento no encontrado en el mapa),
  // se intenta extraer de /presentaciones como último recurso.

  // Principio activo: preferimos el nombre normalizado del primer principio activo
  // medPadre?.principiosActivos es el array [{nombre, cantidad, unidad},...]
  const principioActivo =
    (medPadre?.principiosActivos?.length
      ? medPadre.principiosActivos.map(p => p.nombre).filter(Boolean).join(' / ')
      : null)
    || medPadre?.vtm?.nombre
    || item.vtm?.nombre
    || null;

  // Dosis: /medicamentos devuelve el campo "dosis" directamente (ej: "500 mg")
  // /presentaciones NO tiene este campo, pero tiene principiosActivos[].cantidad+unidad
  const dosis = medPadre?.dosis
    || (medPadre?.principiosActivos?.length
        ? medPadre.principiosActivos.map(p => `${p.cantidad || ''} ${p.unidad || ''}`.trim()).join(' / ')
        : null)
    || null;

  // Forma farmacéutica: solo presente en /medicamentos
  const formaFarmaceutica  = medPadre?.formaFarmaceutica?.nombre  || null;
  const formaSimplificada  = medPadre?.formaFarmaceuticaSimplificada?.nombre || null;

  // Vía de administración: array en /medicamentos, tomamos la primera
  const primeraVia = (medPadre?.viasAdministracion || [])[0];
  const viaAdministracion = primeraVia?.nombre || null;

  // Laboratorio y prescripción: disponibles en ambos endpoints
  const laboratorio       = item.labtitular || item.labcomercializador
    || medPadre?.labtitular || medPadre?.labcomercializador
    || null;
  const tipoPrescripcion  = item.cpresc || medPadre?.cpresc || null;

  return {
    cn:                 String(item.cn),        // PK — código nacional del envase
    nregistro:          String(item.nregistro), // FK al medicamento padre
    nombre:             item.nombre || '',      // nombre completo del envase (incluye tamaño)
    laboratorio,
    dosis,
    principio_activo:   principioActivo,
    forma_farmaceutica: formaFarmaceutica,
    forma_simplificada: formaSimplificada,
    via_administracion: viaAdministracion,
    tipo_prescripcion:  tipoPrescripcion,
    foto_envase_url:    fotoEnvase?.url || null,
    foto_forma_url:     fotoForma?.url  || null,
    url_ficha_tecnica:  docFT?.url      || null,
    url_prospecto:      docProspe?.url  || null,
    last_sync:          new Date().toISOString(),
  };
}

// ─── Upsert por lotes en Supabase ────────────────────────────────────
async function upsertCatalogo(supabase, presentaciones, medicamentosMap) {
  const rows = presentaciones.map(p => transformPresentacion(p, medicamentosMap.get(String(p.nregistro))));
  console.log(`📝 Iniciando UPSERT de ${rows.length} registros en blistercheck_catalogo...`);

  let upsertados = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('blistercheck_catalogo')
      .upsert(batch, { onConflict: 'cn' });   // ← PK ahora es cn

    if (error) {
      throw new Error(`Error en UPSERT (lote ${i / UPSERT_BATCH_SIZE + 1}): ${error.message}`);
    }

    upsertados += batch.length;
    process.stdout.write(`\r   Registros guardados: ${upsertados}/${rows.length}`);
  }
  console.log(''); // Nueva línea
  console.log(`✅ UPSERT completado: ${upsertados} presentaciones actualizadas en Supabase`);
}

// ─── Punto de entrada principal ───────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  BlisterCheck — Sincronización Catálogo CIMA');
  console.log(`  Fecha: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`);
  console.log('═══════════════════════════════════════════════════');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Faltan credenciales de Supabase (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Descargar datos de CIMA (con reintentos y protecciones)
    const medicamentos = await fetchAllMedicamentosComercializados();
    const presentaciones = await fetchAllPresentacionesComercializadas();

    // 1.5 Crear mapa de medicamentos para enriquecer las presentaciones
    const medMap = new Map();
    medicamentos.forEach(m => medMap.set(String(m.nregistro), m));

    // 2. Guardar en Supabase enriquecido
    await upsertCatalogo(supabase, presentaciones, medMap);

    console.log('');
    console.log('🎉 Sincronización completada correctamente.');
    console.log('   ⚠️  NOTA: blistercheck_clasificacion no fue modificada.');
    console.log('═══════════════════════════════════════════════════');

  } catch (err) {
    // Cualquier error (red, API, Supabase) → abortar limpiamente
    // La BD queda intacta con los datos de la última sync exitosa
    console.error('');
    console.error('❌ SINCRONIZACIÓN ABORTADA — Base de datos NO modificada');
    console.error(`   Motivo: ${err.message}`);
    console.error('   Se reintentará en la próxima ejecución programada (14 días).');
    console.log('═══════════════════════════════════════════════════');
    // exit(1) para que GitHub Actions marque el workflow como FALLIDO y envíe notificación
    process.exit(1);
  }
}

main();
