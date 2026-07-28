import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ShieldCheck, BarChart2, Download } from 'lucide-react';
import MedicamentoBuscador from './MedicamentoBuscador';
import MedicamentoDetalle from './MedicamentoDetalle';
import BlisterCheckStats from './BlisterCheckStats';
import BlisterCheckExport from './BlisterCheckExport';
import { getCatalogInfo, getClasificacion } from '../../services/blistercheckService';

function BlisterCheckApp({ onVolver }) {
  const [vistaActiva, setVistaActiva] = useState('search'); // 'search' | 'detail' | 'stats'
  const [medicamentoSeleccionado, setMedicamentoSeleccionado] = useState(null);
  const [clasificacionActual, setClasificacionActual] = useState(null);
  const [catalogInfo, setCatalogInfo] = useState({ totalCatalogo: 0, totalClasificados: 0, enMiFarmacia: 0, ultimaSync: null });
  const [showExport, setShowExport] = useState(false);

  // Cargar info del catálogo al montar
  useEffect(() => {
    getCatalogInfo()
      .then(setCatalogInfo)
      .catch(err => console.error('Error cargando info catálogo:', err));
  }, []);

  const handleSelectMedicamento = useCallback(async (medicamento) => {
    setMedicamentoSeleccionado(medicamento);
    setClasificacionActual(null);
    setVistaActiva('detail');
    try {
      const clas = await getClasificacion(medicamento.nregistro);
      setClasificacionActual(clas);
    } catch (err) {
      console.error('Error cargando clasificación:', err);
    }
  }, []);

  const handleClasificacionGuardada = useCallback((nuevaClasificacion) => {
    setClasificacionActual(nuevaClasificacion);
    // Actualizar contador
    setCatalogInfo(prev => ({
      ...prev,
      totalClasificados: prev.totalClasificados + (clasificacionActual ? 0 : 1),
    }));
  }, [clasificacionActual]);

  const handleVolverABusqueda = useCallback(() => {
    setVistaActiva('search');
    setMedicamentoSeleccionado(null);
    setClasificacionActual(null);
  }, []);

  return (
    <div className="bc-app">
      {/* Barra superior */}
      <div className="bc-topbar glass-panel">
        <div className="bc-topbar__left">
          <button className="bc-back-btn" onClick={onVolver} title="Volver al menú principal">
            <ArrowLeft size={18} />
            <span>Menú</span>
          </button>
          <div className="bc-logo">
            <ShieldCheck size={22} className="bc-logo__icon" />
            <span className="bc-logo__text">BlisterCheck</span>
          </div>
        </div>

        {/* Info del catálogo */}
        <div className="bc-topbar__stats">
          {catalogInfo.totalCatalogo > 0 && (
            <>
              <span className="bc-stat-pill">
                <span className="bc-stat-num">{catalogInfo.totalCatalogo.toLocaleString('es-ES')}</span>
                <span className="bc-stat-label">en catálogo</span>
              </span>
              <span className="bc-stat-pill bc-stat-pill--green">
                <span className="bc-stat-num">{catalogInfo.totalClasificados}</span>
                <span className="bc-stat-label">clasificados</span>
              </span>
              <span className="bc-stat-pill bc-stat-pill--blue">
                <span className="bc-stat-num">{catalogInfo.enMiFarmacia}</span>
                <span className="bc-stat-label">en mi farmacia</span>
              </span>
            </>
          )}
          {catalogInfo.totalCatalogo === 0 && (
            <span className="bc-empty-hint">Catálogo vacío — ejecuta la sincronización manual</span>
          )}
        </div>

        {/* Acciones */}
        <div className="bc-topbar__actions">
          <button
            className={`bc-nav-btn ${vistaActiva === 'search' ? 'active' : ''}`}
            onClick={() => { setVistaActiva('search'); setMedicamentoSeleccionado(null); }}
          >
            Catálogo
          </button>
          <button
            className={`bc-nav-btn ${vistaActiva === 'stats' ? 'active' : ''}`}
            onClick={() => setVistaActiva('stats')}
          >
            <BarChart2 size={15} />
            Estadísticas
          </button>
          <button
            className="bc-nav-btn bc-nav-btn--export"
            onClick={() => setShowExport(true)}
          >
            <Download size={15} />
            Exportar
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="bc-content">
        {vistaActiva === 'search' && (
          <MedicamentoBuscador onSelectMedicamento={handleSelectMedicamento} />
        )}

        {vistaActiva === 'detail' && medicamentoSeleccionado && (
          <MedicamentoDetalle
            medicamento={medicamentoSeleccionado}
            clasificacion={clasificacionActual}
            onClasificacionGuardada={handleClasificacionGuardada}
            onVolver={handleVolverABusqueda}
          />
        )}

        {vistaActiva === 'stats' && (
          <BlisterCheckStats />
        )}
      </div>

      {/* Modal de exportación */}
      {showExport && (
        <BlisterCheckExport onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}

export default BlisterCheckApp;
