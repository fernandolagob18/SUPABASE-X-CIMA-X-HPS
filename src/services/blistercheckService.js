/**
 * BlisterCheck Service — Acceso a datos en Supabase
 * Todas las operaciones del módulo BlisterCheck se canalizan por aquí.
 */

import { supabase } from '../lib/supabase';

const CATALOG_TABLE = 'blistercheck_catalogo';
const CLASIFICACION_TABLE = 'blistercheck_clasificacion';

// ─── BÚSQUEDA SIMPLE ──────────────────────────────────────────────────────────

/**
 * Detecta si el query es un código numérico (búsqueda por CN)
 */
function isNumericQuery(query) {
  return /^\d+$/.test(query.trim());
}

/**
 * Búsqueda simple: por nombre, principio activo o CN
 */
export async function searchSimple(query) {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();

  if (isNumericQuery(q)) {
    // Búsqueda por código nacional (numérico — sin tildes, ilike directo es suficiente)
    const { data, error } = await supabase
      .from(CATALOG_TABLE)
      .select('*')
      .ilike('cn', `${q}%`);
    if (error) throw error;
    return data || [];
  }

  // Búsqueda por nombre / principio activo usando RPC con unaccent (insensible a tildes)
  const { data, error } = await supabase.rpc('bc_search_simple', { q });
  if (error) throw error;
  return data || [];
}

/**
 * Obtiene clasificaciones en batch para un array de CNs.
 * Devuelve un Map<cn, clasificacion> para evitar N+1 queries en las tarjetas de resultados.
 */
export async function getClasificacionesByCNs(cns) {
  if (!cns || cns.length === 0) return new Map();
  const validCNs = [...new Set(cns.filter(Boolean))];
  if (validCNs.length === 0) return new Map();

  const CHUNK_SIZE = 900;
  let allData = [];
  for (let i = 0; i < validCNs.length; i += CHUNK_SIZE) {
    const chunk = validCNs.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from(CLASIFICACION_TABLE)
      .select('*')
      .in('cn', chunk);
    if (error) throw error;
    if (data) allData = allData.concat(data);
  }

  const map = new Map();
  allData.forEach(c => map.set(c.cn, c));
  return map;
}

// ─── BÚSQUEDA AVANZADA ────────────────────────────────────────────────────────

/**
 * Búsqueda avanzada con múltiples filtros opcionales
 * @param {Object} filtros
 * @param {string} filtros.nombre
 * @param {string} filtros.principioActivo
 * @param {string} filtros.formaFarmaceutica
 * @param {string} filtros.viaAdministracion
 */
export async function searchAvanzado(filtros = {}) {
  // Búsqueda base usando el RPC
  // Si hay filtros de estado o de farmacia, el medicamento tiene que estar clasificado por fuerza.
  const requiereEstarClasificado = filtros.soloClasificados || 
                                   filtros.soloEnMiFarmacia || 
                                   (filtros.estadoAcondicionamiento && filtros.estadoAcondicionamiento !== 'todos');

  const { data, error } = await supabase.rpc('bc_search_avanzado', {
    p_cn:                 filtros.cn?.trim()                || null,
    p_nombre:             filtros.nombre?.trim()            || null,
    p_principio_activo:   filtros.principioActivo?.trim()   || null,
    p_laboratorio:        filtros.laboratorio?.trim()       || null,
    p_forma_farmaceutica: filtros.formaFarmaceutica?.trim() || null,
    p_via_administracion: filtros.viaAdministracion?.trim() || null,
    p_solo_clasificados:  requiereEstarClasificado          ?? false,
  });

  if (error) throw error;
  let results = data || [];

  // Si hay filtros adicionales que dependen de la clasificación, necesitamos obtenerla
  if (filtros.soloEnMiFarmacia || (filtros.estadoAcondicionamiento && filtros.estadoAcondicionamiento !== 'todos')) {
    if (results.length === 0) return [];

    const cns = results.map(r => r.cn);  // la PK ahora es cn

    // Obtener clasificaciones en lotes para no exceder los límites de PostgREST
    const CHUNK_SIZE = 900;
    let clasifData = [];
    for (let i = 0; i < cns.length; i += CHUNK_SIZE) {
      const chunk = cns.slice(i, i + CHUNK_SIZE);
      const { data: chunkData, error: chunkError } = await supabase
        .from(CLASIFICACION_TABLE)
        .select('*')
        .in('cn', chunk);
        
      if (chunkError) throw chunkError;
      if (chunkData) clasifData = clasifData.concat(chunkData);
    }

    const clasifMap = new Map();
    (clasifData || []).forEach(c => clasifMap.set(c.cn, c));

    results = results.filter(med => {
      const clasif = clasifMap.get(med.cn);
      if (!clasif) return false;

      if (filtros.soloEnMiFarmacia && !clasif.en_mi_farmacia) return false;

      if (filtros.estadoAcondicionamiento) {
        if (filtros.estadoAcondicionamiento === 'reenvasado'   && clasif.requiere_reenvasado  !== true) return false;
        if (filtros.estadoAcondicionamiento === 'reetiquetado' && clasif.requiere_reetiquetado !== true) return false;
        if (filtros.estadoAcondicionamiento === 'apto_sdmdu'   && clasif.apto_sdmdu_blister   !== true) return false;
      }

      return true;
    });
  }

  return results;
}

// ─── VALORES ÚNICOS PARA FILTROS ──────────────────────────────────────────────

async function fetchAllDistinct(column) {
  // Obtenemos todos los valores distintos paginando secuencialmente.
  // Nota: la opción ideal es una RPC en Supabase con SELECT DISTINCT para evitar
  // transferir filas completas, pero esta solución es segura y no genera un
  // burst de 17 consultas simultáneas como hacía la versión anterior.
  const uniqueVals = new Set();
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(CATALOG_TABLE)
      .select(column)
      .not(column, 'is', null)
      .order(column)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    (data || []).forEach(row => uniqueVals.add(row[column]));
    if ((data || []).length < PAGE_SIZE) break;
    page++;
  }

  return Array.from(uniqueVals).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export async function getFormasFarmaceuticas() {
  return await fetchAllDistinct('forma_farmaceutica');
}

export async function getViasAdministracion() {
  return await fetchAllDistinct('via_administracion');
}

// ─── CLASIFICACIÓN ────────────────────────────────────────────────────────────

/**
 * Obtiene la clasificación de una presentación (null si no existe).
 * Clave: cn (Código Nacional) — la tabla usa cn como PK.
 */
export async function getClasificacion(cn) {
  const { data, error } = await supabase
    .from(CLASIFICACION_TABLE)
    .select('*')
    .eq('cn', cn)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Guarda o actualiza la clasificación de una presentación.
 * Devuelve el registro guardado (incluyendo updated_at) para refrescar la UI.
 */
export async function saveClasificacion(cn, clasificacion) {
  // Pick explícito de columnas conocidas para evitar errores si el form tiene campos extra
  const payload = {
    cn,
    requiere_reenvasado:   clasificacion.requiere_reenvasado   ?? null,
    requiere_reetiquetado: clasificacion.requiere_reetiquetado ?? null,
    apto_sdmdu_blister:    clasificacion.apto_sdmdu_blister    ?? null,
    solo_envase_clinico:   clasificacion.solo_envase_clinico   ?? false,
    en_mi_farmacia:        clasificacion.en_mi_farmacia        ?? false,
    notas:                 clasificacion.notas                 ?? null,
    updated_at:            new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(CLASIFICACION_TABLE)
    .upsert(payload, { onConflict: 'cn' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}


/**
 * Obtiene todas las clasificaciones (para stats y export)
 */
export async function getAllClasificaciones() {
  // Paginamos para soportar más de 1000 clasificaciones
  let allData = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(CLASIFICACION_TABLE)
      .select(`
        *,
        blistercheck_catalogo (
          nombre, laboratorio, dosis, principio_activo,
          forma_farmaceutica, forma_simplificada, via_administracion,
          tipo_prescripcion, cn
        )
      `)
      .order('fecha_clasificacion', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    allData = allData.concat(data || []);
    if ((data || []).length < PAGE_SIZE) break;
    page++;
  }
  return allData;
}

// ─── ESTADÍSTICAS POR LABORATORIO ─────────────────────────────────────────────

/**
 * Calcula estadísticas agrupadas por laboratorio
 * Solo incluye laboratorios con al menos 1 medicamento clasificado
 */
export async function getEstadisticasPorLaboratorio(soloMiFarmacia = false) {
  // Paginamos para soportar más de 1000 clasificaciones (comentario anterior incorrecto)
  let allData = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    let query = supabase
      .from(CLASIFICACION_TABLE)
      .select(`
        cn,
        requiere_reenvasado,
        requiere_reetiquetado,
        apto_sdmdu_blister,
        en_mi_farmacia,
        blistercheck_catalogo ( laboratorio )
      `)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (soloMiFarmacia) query = query.eq('en_mi_farmacia', true);

    const { data, error } = await query;
    if (error) throw error;
    allData = allData.concat(data || []);
    if ((data || []).length < PAGE_SIZE) break;
    page++;
  }

  const labMap = new Map();

  allData.forEach(row => {
    const lab = row.blistercheck_catalogo?.laboratorio || 'Sin laboratorio';
    if (!labMap.has(lab)) {
      labMap.set(lab, {
        laboratorio: lab,
        total_clasificados: 0,
        aptos_directos: 0,
        requieren_intervencion: 0,
        pendientes: 0,
      });
    }

    const entry = labMap.get(lab);
    const sinClasificar = row.apto_sdmdu_blister === null
      && row.requiere_reenvasado === null
      && row.requiere_reetiquetado === null;

    if (!sinClasificar) entry.total_clasificados++;

    if (row.apto_sdmdu_blister === true) entry.aptos_directos++;
    else if (row.requiere_reenvasado === true || row.requiere_reetiquetado === true) entry.requieren_intervencion++;
    else if (sinClasificar) entry.pendientes++;
  });

  const result = Array.from(labMap.values()).map(lab => ({
    ...lab,
    score_sdmdu: lab.total_clasificados > 0
      ? Math.round((lab.aptos_directos / lab.total_clasificados) * 100)
      : 0,
  }));

  result.sort((a, b) => b.score_sdmdu - a.score_sdmdu || b.total_clasificados - a.total_clasificados);
  return result;
}

// ─── INFO GENERAL DEL CATÁLOGO ────────────────────────────────────────────────

export async function getCatalogInfo() {
  // 4 consultas en paralelo en vez de secuenciales (era 4x más lento)
  const [
    { count: totalCatalogo },
    { count: totalClasificados },
    { count: enMiFarmacia },
    { data: syncData },
  ] = await Promise.all([
    supabase.from(CATALOG_TABLE).select('*', { count: 'exact', head: true }),
    supabase.from(CLASIFICACION_TABLE).select('*', { count: 'exact', head: true })
      .or('requiere_reenvasado.not.is.null,requiere_reetiquetado.not.is.null,apto_sdmdu_blister.not.is.null'),
    supabase.from(CLASIFICACION_TABLE).select('*', { count: 'exact', head: true })
      .eq('en_mi_farmacia', true),
    supabase.from(CATALOG_TABLE).select('last_sync').order('last_sync', { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    totalCatalogo:     totalCatalogo     || 0,
    totalClasificados: totalClasificados || 0,
    enMiFarmacia:      enMiFarmacia      || 0,
    ultimaSync:        syncData?.last_sync || null,
  };
}

// ─── EXPORTACIÓN CSV ─────────────────────────────────────────────────────────

/**
 * Obtiene datos para exportar (JOIN entre clasificación y catálogo)
 * @param {string} modo 'todos' | 'clasificados' | 'mi_farmacia'
 */
export async function getExportData(modo = 'clasificados') {
  const SELECT = `
    cn,
    requiere_reenvasado,
    requiere_reetiquetado,
    apto_sdmdu_blister,
    solo_envase_clinico,
    en_mi_farmacia,
    notas,
    fecha_clasificacion,
    updated_at,
    blistercheck_catalogo (
      cn, nregistro, nombre, laboratorio, dosis, principio_activo,
      forma_farmaceutica, forma_simplificada, via_administracion, tipo_prescripcion
    )
  `;

  // Paginamos para soportar más de 1000 clasificaciones sin truncar el CSV
  let allData = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    let query = supabase
      .from(CLASIFICACION_TABLE)
      .select(SELECT)
      .order('fecha_clasificacion', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (modo === 'clasificados') {
      query = query.or('requiere_reenvasado.not.is.null,requiere_reetiquetado.not.is.null,apto_sdmdu_blister.not.is.null');
    }
    if (modo === 'mi_farmacia') {
      query = query.eq('en_mi_farmacia', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    allData = allData.concat(data || []);
    if ((data || []).length < PAGE_SIZE) break;
    page++;
  }

  return allData;
}

// ─── ALTERNATIVAS SDMDU ────────────────────────────────────────────────────────

/**
 * Busca alternativas de un medicamento con el mismo principio activo, dosis, forma y vía,
 * y las clasifica en compatibles (apto SDMDU) y pendientes de evaluar.
 */
export async function getAlternativasSDMDU(medicamento) {
  const { cn, principio_activo, dosis, forma_farmaceutica, via_administracion } = medicamento;
  
  if (!principio_activo || !dosis || !forma_farmaceutica || !via_administracion) {
    return { compatibles: [], pendientes: [] };
  }

  const { data, error } = await supabase
    .from(CATALOG_TABLE)
    .select(`
      *,
      blistercheck_clasificacion (
        apto_sdmdu_blister,
        requiere_reenvasado,
        requiere_reetiquetado
      )
    `)
    .eq('principio_activo', principio_activo)
    .eq('dosis', dosis)
    .eq('forma_farmaceutica', forma_farmaceutica)
    .eq('via_administracion', via_administracion)
    .neq('cn', cn);  // excluir el medicamento actual por CN (PK real)

  if (error) throw error;

  const compatibles = [];
  const pendientes = [];
  
  (data || []).forEach(med => {
    // Si la propiedad blistercheck_clasificacion es un array (por relación uno a muchos), tomamos el primero
    const clas = Array.isArray(med.blistercheck_clasificacion) ? med.blistercheck_clasificacion[0] : med.blistercheck_clasificacion;
    
    if (clas && clas.apto_sdmdu_blister === true) {
      compatibles.push(med);
    } else if (!clas || (clas.apto_sdmdu_blister === null && clas.requiere_reenvasado === null && clas.requiere_reetiquetado === null)) {
      pendientes.push(med);
    }
  });

  return { compatibles, pendientes };
}

// ─── DESABASTECIMIENTOS ────────────────────────────────────────────────────────

/**
 * Busca si una presentación (por CN) tiene un desabastecimiento activo.
 * JOIN directo posible porque blistercheck_catalogo.cn = desabastecimientos_activos.cn.
 * @param {string|null} cn - Código Nacional de la presentación
 * @returns {Promise<Object|null>}
 */
export async function getDesabastecimientoByCN(cn) {
  if (!cn) return null;

  const { data, error } = await supabase
    .from('desabastecimientos_activos')
    .select('*')
    .eq('cn', String(cn))
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Dado un array de CNs, devuelve un Map<cn, shortage> con todos los que tienen
 * desabastecimiento activo. Una única consulta IN.
 * @param {string[]} cns
 * @returns {Promise<Map<string, Object>>}
 */
export async function getDesabastecimientosByCNs(cns) {
  if (!cns || cns.length === 0) return new Map();
  const validCNs = [...new Set(cns.filter(Boolean).map(cn => String(cn)))];
  if (validCNs.length === 0) return new Map();

  // Chunking para no exceder el límite de PostgREST con .in() largo
  const CHUNK_SIZE = 900;
  const map = new Map();
  for (let i = 0; i < validCNs.length; i += CHUNK_SIZE) {
    const chunk = validCNs.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('desabastecimientos_activos')
      .select('*')
      .in('cn', chunk);
    if (error) throw error;
    (data || []).forEach(row => map.set(String(row.cn), row));
  }
  return map;
}
