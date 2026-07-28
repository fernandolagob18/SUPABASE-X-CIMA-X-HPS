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
  let supabaseQuery;

  if (isNumericQuery(q)) {
    // Búsqueda por código nacional
    supabaseQuery = supabase
      .from(CATALOG_TABLE)
      .select('*')
      .ilike('cn', `${q}%`);
  } else {
    // Búsqueda por nombre de marca o principio activo
    supabaseQuery = supabase
      .from(CATALOG_TABLE)
      .select('*')
      .or(`nombre.ilike.%${q}%,principio_activo.ilike.%${q}%`)
      .order('nombre', { ascending: true });
  }

  const { data, error } = await supabaseQuery;
  if (error) throw error;
  return data || [];
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
  let query;
  
  if (filtros.soloClasificados) {
    query = supabase
      .from(CATALOG_TABLE)
      .select(`
        *,
        blistercheck_clasificacion!inner(nregistro)
      `)
      .order('nombre', { ascending: true });
  } else {
    query = supabase
      .from(CATALOG_TABLE)
      .select('*')
      .order('nombre', { ascending: true });
  }

  if (filtros.nombre?.trim()) {
    query = query.ilike('nombre', `%${filtros.nombre.trim()}%`);
  }
  if (filtros.principioActivo?.trim()) {
    query = query.ilike('principio_activo', `%${filtros.principioActivo.trim()}%`);
  }
  if (filtros.laboratorio?.trim()) {
    query = query.ilike('laboratorio', `%${filtros.laboratorio.trim()}%`);
  }
  if (filtros.formaFarmaceutica?.trim()) {
    query = query.eq('forma_farmaceutica', filtros.formaFarmaceutica.trim());
  }
  if (filtros.viaAdministracion?.trim()) {
    query = query.ilike('via_administracion', `%${filtros.viaAdministracion.trim()}%`);
  }


  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── VALORES ÚNICOS PARA FILTROS ──────────────────────────────────────────────

export async function getFormasFarmaceuticas() {
  const { data, error } = await supabase
    .from(CATALOG_TABLE)
    .select('forma_farmaceutica')
    .not('forma_farmaceutica', 'is', null)
    .order('forma_farmaceutica');

  if (error) throw error;
  // Devolver valores únicos
  return [...new Set((data || []).map(r => r.forma_farmaceutica))].filter(Boolean);
}

export async function getViasAdministracion() {
  const { data, error } = await supabase
    .from(CATALOG_TABLE)
    .select('via_administracion')
    .not('via_administracion', 'is', null)
    .order('via_administracion');

  if (error) throw error;
  return [...new Set((data || []).map(r => r.via_administracion))].filter(Boolean);
}

// ─── CLASIFICACIÓN ────────────────────────────────────────────────────────────

/**
 * Obtiene la clasificación de un medicamento (null si no existe)
 */
export async function getClasificacion(nregistro) {
  const { data, error } = await supabase
    .from(CLASIFICACION_TABLE)
    .select('*')
    .eq('nregistro', nregistro)
    .maybeSingle();

  if (error) throw error;
  return data; // null si no clasificado aún
}

/**
 * Guarda o actualiza la clasificación de un medicamento
 */
export async function saveClasificacion(nregistro, clasificacion) {
  const { error } = await supabase
    .from(CLASIFICACION_TABLE)
    .upsert({
      nregistro,
      ...clasificacion,
    }, { onConflict: 'nregistro' });

  if (error) throw error;
}

/**
 * Obtiene todas las clasificaciones (para stats y export)
 */
export async function getAllClasificaciones() {
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
    .order('fecha_clasificacion', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ─── ESTADÍSTICAS POR LABORATORIO ─────────────────────────────────────────────

/**
 * Calcula estadísticas agrupadas por laboratorio
 * Solo incluye laboratorios con al menos 1 medicamento clasificado
 */
export async function getEstadisticasPorLaboratorio(soloMiFarmacia = false) {
  let query = supabase
    .from(CLASIFICACION_TABLE)
    .select(`
      nregistro,
      requiere_reenvasado,
      requiere_reetiquetado,
      apto_sdmdu_blister,
      en_mi_farmacia,
      blistercheck_catalogo ( laboratorio )
    `);

  if (soloMiFarmacia) {
    query = query.eq('en_mi_farmacia', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Agrupar por laboratorio
  const labMap = new Map();

  (data || []).forEach(row => {
    const lab = row.blistercheck_catalogo?.laboratorio || 'Sin laboratorio';
    if (!labMap.has(lab)) {
      labMap.set(lab, {
        laboratorio: lab,
        total_clasificados: 0,
        aptos_directos: 0,       // apto_sdmdu_blister = true
        requieren_intervencion: 0, // requiere_reenvasado=true OR requiere_reetiquetado=true
        pendientes: 0,           // todos null
      });
    }

    const entry = labMap.get(lab);
    entry.total_clasificados++;

    const esApto = row.apto_sdmdu_blister === true;
    const requiereIntervencion = row.requiere_reenvasado === true || row.requiere_reetiquetado === true;
    const sinClasificar = row.apto_sdmdu_blister === null && row.requiere_reenvasado === null && row.requiere_reetiquetado === null;

    if (esApto) entry.aptos_directos++;
    else if (requiereIntervencion) entry.requieren_intervencion++;
    else if (sinClasificar) entry.pendientes++;
  });

  // Calcular score y convertir a array ordenado
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
  const { count: totalCatalogo } = await supabase
    .from(CATALOG_TABLE)
    .select('*', { count: 'exact', head: true });

  const { count: totalClasificados } = await supabase
    .from(CLASIFICACION_TABLE)
    .select('*', { count: 'exact', head: true });

  const { count: enMiFarmacia } = await supabase
    .from(CLASIFICACION_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('en_mi_farmacia', true);

  const { data: syncData } = await supabase
    .from(CATALOG_TABLE)
    .select('last_sync')
    .order('last_sync', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    totalCatalogo: totalCatalogo || 0,
    totalClasificados: totalClasificados || 0,
    enMiFarmacia: enMiFarmacia || 0,
    ultimaSync: syncData?.last_sync || null,
  };
}

// ─── EXPORTACIÓN CSV ─────────────────────────────────────────────────────────

/**
 * Obtiene datos para exportar (JOIN entre clasificación y catálogo)
 * @param {string} modo 'todos' | 'clasificados' | 'mi_farmacia'
 */
export async function getExportData(modo = 'clasificados') {
  let query = supabase
    .from(CLASIFICACION_TABLE)
    .select(`
      nregistro,
      requiere_reenvasado,
      requiere_reetiquetado,
      apto_sdmdu_blister,
      en_mi_farmacia,
      notas,
      fecha_clasificacion,
      updated_at,
      blistercheck_catalogo (
        cn, nombre, laboratorio, dosis, principio_activo,
        forma_farmaceutica, forma_simplificada, via_administracion, tipo_prescripcion
      )
    `)
    .order('fecha_clasificacion', { ascending: false });

  if (modo === 'mi_farmacia') {
    query = query.eq('en_mi_farmacia', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
