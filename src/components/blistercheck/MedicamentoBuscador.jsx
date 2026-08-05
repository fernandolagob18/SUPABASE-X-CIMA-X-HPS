import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import CustomSelect from './CustomSelect';
import MedicamentoCard from './MedicamentoCard';
import {
  searchSimple,
  searchAvanzado,
  getFormasFarmaceuticas,
  getViasAdministracion,
  getDesabastecimientosByCNs,
  getClasificacionesByCNs,
} from '../../services/blistercheckService';


function MedicamentoBuscador({ onSelectMedicamento }) {
  // Buscador simple
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [buscadoAlgunaVez, setBuscadoAlgunaVez] = useState(false);

  // Mapa CN → desabastecimiento para los resultados actuales (1 sola consulta batch)
  const [shortageMap, setShortageMap] = useState(new Map());
  // Mapa CN → clasificacion para los resultados actuales (1 sola consulta batch, evita N queries)
  const [clasificacionMap, setClasificacionMap] = useState(new Map());

  // Buscador avanzado
  const [showAvanzado, setShowAvanzado] = useState(false);
  const [filtros, setFiltros] = useState({
    cn: '',
    nombre: '',
    principioActivo: '',
    laboratorio: '',
    formaFarmaceutica: '',
    viaAdministracion: '',
    soloClasificados: false,
    soloEnMiFarmacia: false,
    estadoAcondicionamiento: 'todos',
  });
  const [formas, setFormas] = useState([]);
  const [vias, setVias] = useState([]);

  const debounceRef = useRef(null);

  /**
   * Lanza una única consulta batch a desabastecimientos_activos
   * para todos los CNs de los resultados actuales.
   */
  const fetchShortages = useCallback(async (results) => {
    if (!results || results.length === 0) {
      setShortageMap(new Map());
      return;
    }
    const cns = results.map(m => m.cn).filter(Boolean);
    try {
      const map = await getDesabastecimientosByCNs(cns);
      setShortageMap(map);
    } catch (err) {
      console.error('Error comprobando desabastecimientos:', err);
      setShortageMap(new Map());
    }
  }, []);

  const fetchClasificaciones = useCallback(async (results) => {
    if (!results || results.length === 0) {
      setClasificacionMap(new Map());
      return;
    }
    const cns = results.map(m => m.cn).filter(Boolean);
    try {
      const map = await getClasificacionesByCNs(cns);
      setClasificacionMap(map);
    } catch (err) {
      console.error('Error cargando clasificaciones batch:', err);
      setClasificacionMap(new Map());
    }
  }, []);

  // Cargar opciones de filtros al montar
  useEffect(() => {
    getFormasFarmaceuticas().then(setFormas).catch(() => {});
    getViasAdministracion().then(setVias).catch(() => {});
  }, []);

  // Búsqueda simple con debounce
  useEffect(() => {
    if (showAvanzado) return; // En modo avanzado no se dispara el simple
    clearTimeout(debounceRef.current);
    let isCurrent = true;

    if (!query.trim() || query.trim().length < 2) {
      if (query.trim().length === 0) {
        setResultados([]);
        setBuscadoAlgunaVez(false);
      }
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setBuscadoAlgunaVez(true);
      
      try {
        const data = await searchSimple(query);
        if (isCurrent) {
          setResultados(data);
          fetchShortages(data);
          fetchClasificaciones(data);
        }
      } catch (err) {
        if (isCurrent) {
          setError('Error al buscar. Comprueba tu conexión.');
          setResultados([]);
          setShortageMap(new Map());
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    }, 400);

    return () => {
      isCurrent = false;
      clearTimeout(debounceRef.current);
    };
  }, [query, showAvanzado]);

  // Ejecutar búsqueda avanzada
  const handleBuscarAvanzado = useCallback(async (filtrosOverride) => {
    // Evitar que el evento onClick se pase como filtrosOverride
    const f = (filtrosOverride && !filtrosOverride.nativeEvent && !filtrosOverride.type) ? filtrosOverride : filtros;
    const tieneAlgunFiltro = Object.entries(f).some(([key, v]) => {
      if (typeof v === 'boolean') return v;
      if (key === 'estadoAcondicionamiento' && v === 'todos') return false;
      return v.trim() !== '';
    });
    if (!tieneAlgunFiltro) return;

    setLoading(true);
    setError(null);
    setBuscadoAlgunaVez(true);
    try {
      const data = await searchAvanzado(f);
      setResultados(data);
      fetchShortages(data);
      fetchClasificaciones(data);
    } catch (err) {
      setError('Error al buscar. Comprueba tu conexión.');
      setResultados([]);
      setShortageMap(new Map());
    } finally {
      setLoading(false);
    }
  }, [filtros, fetchShortages]);

  const handleLimpiarAvanzado = () => {
    setFiltros({ cn: '', nombre: '', principioActivo: '', laboratorio: '', formaFarmaceutica: '', viaAdministracion: '', soloClasificados: false, soloEnMiFarmacia: false, estadoAcondicionamiento: 'todos' });
    setResultados([]);
    setShortageMap(new Map());
    setClasificacionMap(new Map());
    setBuscadoAlgunaVez(false);
  };

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const toggleAvanzado = () => {
    setShowAvanzado(prev => !prev);
    setQuery('');
    setResultados([]);
    setBuscadoAlgunaVez(false);
    setError(null);
  };

  return (
    <div className="bc-buscador">
      {/* ── Barra de búsqueda ── */}
      <div className="bc-search-header glass-panel">
        <div className="bc-search-row">
          {!showAvanzado && (
            <div className="bc-search-bar">
              <Search size={18} className="bc-search-icon" />
              <input
                type="text"
                className="bc-search-input"
                placeholder="Buscar por nombre, principio activo o código nacional (CN)..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
              {query && (
                <button className="bc-search-clear" onClick={() => { setQuery(''); setResultados([]); setBuscadoAlgunaVez(false); }}>
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          <button
            className={`bc-avanzado-toggle ${showAvanzado ? 'active' : ''}`}
            onClick={toggleAvanzado}
          >
            <SlidersHorizontal size={16} />
            {showAvanzado ? 'Búsqueda simple' : 'Búsqueda avanzada'}
            {showAvanzado ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          <button
            className="bc-avanzado-toggle"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            onClick={() => {
              setQuery('');
              setShowAvanzado(true);
              const f = { ...filtros, soloClasificados: true };
              setFiltros(f);
              handleBuscarAvanzado(f);
            }}
          >
            <ShieldCheck size={16} /> Ver ya clasificados
          </button>
        </div>

        {/* ── Panel de búsqueda avanzada ── */}
        {showAvanzado && (
          <div className="bc-avanzado-panel">
            <div className="bc-avanzado-grid">
              <div className="bc-filtro-field">
                <label className="bc-filtro-label">Nombre del medicamento</label>
                <input
                  type="text"
                  className="bc-filtro-input"
                  placeholder="Ej: Omeprazol..."
                  value={filtros.nombre}
                  onChange={e => handleFiltroChange('nombre', e.target.value)}
                />
              </div>

              <div className="bc-filtro-field">
                <label className="bc-filtro-label">Código Nacional (CN)</label>
                <input
                  type="text"
                  className="bc-filtro-input"
                  placeholder="Ej: 726291..."
                  value={filtros.cn}
                  onChange={e => handleFiltroChange('cn', e.target.value)}
                />
              </div>

              <div className="bc-filtro-field">
                <label className="bc-filtro-label">Principio activo</label>
                <input
                  type="text"
                  className="bc-filtro-input"
                  placeholder="Ej: ibuprofeno..."
                  value={filtros.principioActivo}
                  onChange={e => handleFiltroChange('principioActivo', e.target.value)}
                />
              </div>

              <div className="bc-filtro-field">
                <label className="bc-filtro-label">Laboratorio</label>
                <input
                  type="text"
                  className="bc-filtro-input"
                  placeholder="Ej: Cinfa, Normon..."
                  value={filtros.laboratorio}
                  onChange={e => handleFiltroChange('laboratorio', e.target.value)}
                />
              </div>

              <div className="bc-filtro-field">
                <label className="bc-filtro-label">Forma farmacéutica</label>
                <CustomSelect
                  options={formas}
                  value={filtros.formaFarmaceutica}
                  onChange={val => handleFiltroChange('formaFarmaceutica', val)}
                  placeholder="Todas"
                  searchPlaceholder="Buscar forma farmacéutica..."
                />
              </div>

              <div className="bc-filtro-field">
                <label className="bc-filtro-label">Vía de administración</label>
                <CustomSelect
                  options={vias}
                  value={filtros.viaAdministracion}
                  onChange={val => handleFiltroChange('viaAdministracion', val)}
                  placeholder="Todas"
                  searchPlaceholder="Buscar vía de administración..."
                />
              </div>

            </div>
            
            <div className="bc-filtro-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.6rem', padding: '1rem', background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                id="solo-clasificados"
                checked={filtros.soloClasificados}
                onChange={e => handleFiltroChange('soloClasificados', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <label htmlFor="solo-clasificados" style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-text)', fontWeight: 600 }}>
                Mostrar únicamente medicamentos que ya han sido clasificados
              </label>
            </div>

            <div className="bc-filtro-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.6rem', padding: '1rem', background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                id="solo-en-mi-farmacia"
                checked={filtros.soloEnMiFarmacia}
                onChange={e => handleFiltroChange('soloEnMiFarmacia', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <label htmlFor="solo-en-mi-farmacia" style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-text)', fontWeight: 600 }}>
                Mostrar únicamente medicamentos que están en mi farmacia
              </label>
            </div>

            <div className="bc-filtro-field" style={{ marginBottom: '1rem' }}>
              <label className="bc-filtro-label" style={{ marginBottom: '0.5rem', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>
                Estado de acondicionamiento
              </label>
              <select
                className="bc-filtro-input"
                style={{ cursor: 'pointer' }}
                value={filtros.estadoAcondicionamiento}
                onChange={e => handleFiltroChange('estadoAcondicionamiento', e.target.value)}
              >
                <option value="todos">Todos los medicamentos</option>
                <option value="reenvasado">Requieren reenvasado</option>
                <option value="reetiquetado">Requieren reetiquetado</option>
                <option value="apto_sdmdu">Aptos para SDMDU</option>
              </select>
            </div>

            <div className="bc-avanzado-actions">
              <button className="bc-btn-limpiar" onClick={handleLimpiarAvanzado}>
                <X size={15} /> Limpiar filtros
              </button>
              <button className="bc-btn-buscar" onClick={() => handleBuscarAvanzado()}>
                <Search size={15} /> Buscar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Resultados ── */}
      <div className="bc-resultados">
        {loading && (
          <div className="bc-loading">
            <div className="bc-spinner" />
            <span>Buscando en el catálogo...</span>
          </div>
        )}

        {error && !loading && (
          <div className="bc-error glass-panel">{error}</div>
        )}

        {!loading && !error && buscadoAlgunaVez && resultados.length === 0 && (
          <div className="bc-empty glass-panel">
            <Search size={32} opacity={0.3} />
            <p>No se encontraron medicamentos con ese criterio.</p>
            <p className="bc-empty-hint">Prueba con un término diferente o usa la búsqueda avanzada.</p>
          </div>
        )}

        {!loading && !buscadoAlgunaVez && (
          <div className="bc-welcome glass-panel">
            <ShieldCheckIcon />
            <h3>Catálogo BlisterCheck</h3>
            <p>Busca cualquier medicamento comercializado en España para clasificar su aptitud para el Sistema de Dispensación en Dosis Unitarias (SDMDU).</p>
            <div className="bc-welcome-tips">
              <span>💊 Busca por nombre de marca</span>
              <span>🔬 Busca por principio activo</span>
              <span>🔍 Usa filtros avanzados por forma farmacéutica</span>
            </div>
          </div>
        )}

        {!loading && resultados.length > 0 && (
          <>
            <p className="bc-resultados-count">
              {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
            </p>
            <div className="bc-resultados-grid">
              {resultados.map(med => {
                const desabastecimiento = med.cn ? (shortageMap.get(String(med.cn)) || null) : null;
                const clasificacion = med.cn ? (clasificacionMap.get(med.cn) ?? undefined) : undefined;
                return (
                  <MedicamentoCard
                    key={med.cn}
                    medicamento={med}
                    onClick={() => onSelectMedicamento(med)}
                    desabastecimiento={desabastecimiento}
                    clasificacion={clasificacion}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Icono inline para la pantalla de bienvenida
function ShieldCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: '1rem' }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

export default MedicamentoBuscador;
