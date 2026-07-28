import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import MedicamentoCard from './MedicamentoCard';
import {
  searchSimple,
  searchAvanzado,
  getFormasSimplificadas,
  getViasAdministracion,
} from '../../services/blistercheckService';

const TIPOS_PRESCRIPCION = [
  'Todos',
  'Sin Receta',
  'Medicamento Sujeto A Prescripción Médica',
];

function MedicamentoBuscador({ onSelectMedicamento }) {
  // Buscador simple
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [buscadoAlgunaVez, setBuscadoAlgunaVez] = useState(false);

  // Buscador avanzado
  const [showAvanzado, setShowAvanzado] = useState(false);
  const [filtros, setFiltros] = useState({
    nombre: '',
    principioActivo: '',
    laboratorio: '',
    formaSimplificada: '',
    viaAdministracion: '',
    tipoPrescripcion: '',
  });
  const [formas, setFormas] = useState([]);
  const [vias, setVias] = useState([]);

  const debounceRef = useRef(null);

  // Cargar opciones de filtros al montar
  useEffect(() => {
    getFormasSimplificadas().then(setFormas).catch(() => {});
    getViasAdministracion().then(setVias).catch(() => {});
  }, []);

  // Búsqueda simple con debounce
  useEffect(() => {
    if (showAvanzado) return; // En modo avanzado no se dispara el simple
    clearTimeout(debounceRef.current);

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
        setResultados(data);
      } catch (err) {
        setError('Error al buscar. Comprueba tu conexión.');
        setResultados([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query, showAvanzado]);

  // Ejecutar búsqueda avanzada
  const handleBuscarAvanzado = useCallback(async () => {
    const tieneAlgunFiltro = Object.values(filtros).some(v => v.trim() !== '');
    if (!tieneAlgunFiltro) return;

    setLoading(true);
    setError(null);
    setBuscadoAlgunaVez(true);
    try {
      const data = await searchAvanzado(filtros);
      setResultados(data);
    } catch (err) {
      setError('Error al buscar. Comprueba tu conexión.');
      setResultados([]);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  const handleLimpiarAvanzado = () => {
    setFiltros({ nombre: '', principioActivo: '', laboratorio: '', formaSimplificada: '', viaAdministracion: '', tipoPrescripcion: '' });
    setResultados([]);
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
                placeholder="Buscar por nombre, principio activo o código nacional..."
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
                <select
                  className="bc-filtro-select"
                  value={filtros.formaSimplificada}
                  onChange={e => handleFiltroChange('formaSimplificada', e.target.value)}
                >
                  <option value="">Todas</option>
                  {formas.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="bc-filtro-field">
                <label className="bc-filtro-label">Vía de administración</label>
                <select
                  className="bc-filtro-select"
                  value={filtros.viaAdministracion}
                  onChange={e => handleFiltroChange('viaAdministracion', e.target.value)}
                >
                  <option value="">Todas</option>
                  {vias.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div className="bc-filtro-field">
                <label className="bc-filtro-label">Prescripción</label>
                <select
                  className="bc-filtro-select"
                  value={filtros.tipoPrescripcion}
                  onChange={e => handleFiltroChange('tipoPrescripcion', e.target.value)}
                >
                  {TIPOS_PRESCRIPCION.map(t => (
                    <option key={t} value={t === 'Todos' ? '' : t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bc-avanzado-actions">
              <button className="bc-btn-limpiar" onClick={handleLimpiarAvanzado}>
                <X size={15} /> Limpiar filtros
              </button>
              <button className="bc-btn-buscar" onClick={handleBuscarAvanzado}>
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
              <span>🔢 Busca por código nacional</span>
              <span>🔍 Usa filtros avanzados por forma farmacéutica</span>
            </div>
          </div>
        )}

        {!loading && resultados.length > 0 && (
          <>
            <p className="bc-resultados-count">
              {resultados.length === 50 ? 'Mostrando los primeros 50 resultados' : `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''}`}
            </p>
            <div className="bc-resultados-grid">
              {resultados.map(med => (
                <MedicamentoCard
                  key={med.nregistro}
                  medicamento={med}
                  onClick={() => onSelectMedicamento(med)}
                />
              ))}
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
