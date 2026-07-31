import { Pill, ShieldCheck, AlertOctagon, PackageOpen, Calculator } from 'lucide-react';

function MainMenuScreen({ onSelectModule, onLogout, userEmail }) {
  return (
    <div className="main-menu-overlay">
      <div className="main-menu-container">
        {/* Header */}
        <div className="main-menu-header">
          <div className="main-menu-logo">
            <Pill size={28} color="white" />
          </div>
          <div>
            <h1 className="main-menu-title">HPS Suite</h1>
            <p className="main-menu-subtitle">Herramientas de Farmacia Hospitalaria</p>
          </div>
          <div className="main-menu-user">
            <span className="main-menu-email">{userEmail}</span>
            <button className="main-menu-logout" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Módulos */}
        <p className="main-menu-prompt">Selecciona un módulo para continuar</p>

        <div className="main-menu-grid">
          {/* CIMA Watch */}
          <button
            className="module-card module-card--watch"
            onClick={() => onSelectModule('cimawatch')}
          >
            <div className="module-card__icon module-card__icon--watch">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="module-card__content">
              <h2 className="module-card__title">CIMA Watch</h2>
              <p className="module-card__desc">
                Monitor de desabastecimientos de medicamentos en España. Alertas en tiempo real con seguimiento de tu catálogo.
              </p>
              <div className="module-card__tags">
                <span className="module-tag">Desabastecimientos</span>
                <span className="module-tag">Alertas</span>
                <span className="module-tag">Seguimiento</span>
              </div>
            </div>
            <div className="module-card__arrow">→</div>
          </button>

          {/* BlisterCheck */}
          <button
            className="module-card module-card--blister"
            onClick={() => onSelectModule('blistercheck')}
          >
            <div className="module-card__icon module-card__icon--blister">
              <ShieldCheck size={36} />
            </div>
            <div className="module-card__content">
              <h2 className="module-card__title">BlisterCheck</h2>
              <p className="module-card__desc">
                Catálogo SDMDU de medicamentos comercializados. Clasifica aptitud para blíster fraccionable, reenvasado y reetiquetado.
              </p>
              <div className="module-card__tags">
                <span className="module-tag">SDMDU</span>
                <span className="module-tag">Blíster</span>
                <span className="module-tag">Catálogo AEMPS</span>
              </div>
            </div>
            <div className="module-card__arrow">→</div>
          </button>
        </div>

        <div className="main-menu-grid" style={{ marginTop: '1.5rem' }}>
          {/* Guía NIOSH 2024 */}
          <button
            className="module-card module-card--niosh"
            onClick={() => onSelectModule('niosh')}
            style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <div className="module-card__icon module-card__icon--niosh" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <AlertOctagon size={36} />
            </div>
            <div className="module-card__content">
              <h2 className="module-card__title">Guía NIOSH 2024</h2>
              <p className="module-card__desc">
                Buscador de fármacos peligrosos para farmacia hospitalaria. Identifica medicamentos con Información Especial de Manejo (MSHI).
              </p>
              <div className="module-card__tags">
                <span className="module-tag">Riesgo</span>
                <span className="module-tag">Citotóxicos</span>
                <span className="module-tag">SNG</span>
              </div>
            </div>
            <div className="module-card__arrow">→</div>
          </button>

          {/* Pedidos Mínimos Laboratorios */}
          <button
            className="module-card module-card--pedidos"
            onClick={() => onSelectModule('pedidosminimos')}
          >
            <div className="module-card__icon module-card__icon--pedidos">
              <PackageOpen size={36} />
            </div>
            <div className="module-card__content">
              <h2 className="module-card__title">Pedidos Mínimos</h2>
              <p className="module-card__desc">
                Gestiona los importes mínimos de pedido por laboratorio. Consulta, añade y actualiza los umbrales de compra sin IVA.
              </p>
              <div className="module-card__tags">
                <span className="module-tag">Laboratorios</span>
                <span className="module-tag">Compras</span>
                <span className="module-tag">Pedidos</span>
              </div>
            </div>
            <div className="module-card__arrow">→</div>
          </button>
        </div>

        <div className="main-menu-grid" style={{ marginTop: '1.5rem' }}>
          {/* Análisis Económico */}
          <button
            className="module-card module-card--economico"
            onClick={() => onSelectModule('analisiseconomico')}
            style={{ borderColor: 'rgba(14, 165, 233, 0.2)' }}
          >
            <div className="module-card__icon module-card__icon--economico" style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
              <Calculator size={36} />
            </div>
            <div className="module-card__content">
              <h2 className="module-card__title">Análisis Económico</h2>
              <p className="module-card__desc">
                Carga archivos de consumos o compras y obtén un desglose económico detallado del gasto por servicio o proveedor.
              </p>
              <div className="module-card__tags">
                <span className="module-tag">Economía</span>
                <span className="module-tag">Consumos</span>
                <span className="module-tag">Compras</span>
                <span className="module-tag">Desglose</span>
              </div>
            </div>
            <div className="module-card__arrow">→</div>
          </button>
        </div>

        <p className="main-menu-footer">
          Datos sincronizados con la API de CIMA — AEMPS
        </p>
      </div>
    </div>
  );
}

export default MainMenuScreen;
