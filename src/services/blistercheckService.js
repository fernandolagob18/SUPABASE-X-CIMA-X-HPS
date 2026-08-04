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

    const nregistros = results.map(r => r.nregistro);

    // Obtener clasificaciones. Si son más de 1000, dividimos en lotes para no exceder los límites de PostgREST
    const CHUNK_SIZE = 900;
    const chunks = [];
    for (let i = 0; i < cns.length; i += CHUNK_SIZE) {
      chunks.push(cns.slice(i, i + CHUNK_SIZE));
    }

    let clasifData = [];
    for (const chunk of chunks) {
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

      if (filtros.soloEnMiFarmacia && !clasif.en_mi_farmacia) {
        return false;
      }

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
  const { count } = await supabase
    .from(CATALOG_TABLE)
    .select('*', { count: 'exact', head: true });
    
  const total = count || 17000;
  const limit = 1000;
  const numPages = Math.ceil(total / limit);
  const promises = [];
  
  for (let i = 0; i < numPages; i++) {
    promises.push(
      supabase
        .from(CATALOG_TABLE)
        .select(column)
        .not(column, 'is', null)
        .range(i * limit, (i + 1) * limit - 1)
    );
  }
  
  const results = await Promise.all(promises);
  const uniqueVals = new Set();
  
  results.forEach(res => {
    if (res.data) {
      res.data.forEach(row => uniqueVals.add(row[column]));
    }
  });
  
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
  const { data, error } = await supabase
    .from(CLASIFICACION_TABLE)
    .upsert({
      cn,
      ...clasificacion,
      updated_at: new Date().toISOString()
    }, { onConflict: 'cn' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
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

    const sinClasificar = row.apto_sdmdu_blister === null && row.requiere_reenvasado === null && row.requiere_reetiquetado === null;

    if (!sinClasificar) {
      entry.total_clasificados++;
    }

    const esApto = row.apto_sdmdu_blister === true;
    const requiereIntervencion = row.requiere_reenvasado === true || row.requiere_reetiquetado === true;

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
    .select('*', { count: 'exact', head: true })
    .or('requiere_reenvasado.not.is.null,requiere_reetiquetado.not.is.null,apto_sdmdu_blister.not.is.null');

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
      solo_envase_clinico,
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

  if (modo === 'clasificados') {
    query = query.or('requiere_reenvasado.not.is.null,requiere_reetiquetado.not.is.null,apto_sdmdu_blister.not.is.null');
  }

  if (modo === 'mi_farmacia') {
    query = query.eq('en_mi_farmacia', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── ALTERNATIVAS SDMDU ────────────────────────────────────────────────────────

/**
 * Busca alternativas de un medicamento con el mismo principio activo, dosis, forma y vía,
 * y las clasifica en compatibles (apto SDMDU) y pendientes de evaluar.
 */
export async function getAlternativasSDMDU(medicamento) {
  const { nregistro, principio_activo, dosis, forma_farmaceutica, via_administracion } = medicamento;
  
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
    .neq('nregistro', nregistro);

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

  const { data, error } = await supabase
    .from('desabastecimientos_activos')
    .select('*')
    .in('cn', validCNs);

  if (error) throw error;
  const map = new Map();
  (data || []).forEach(row => map.set(String(row.cn), row));
  return map;
}
