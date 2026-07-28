import { Pill, ShieldCheck } from 'lucide-react';

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

        <p className="main-menu-footer">
          Datos sincronizados con la API de CIMA — AEMPS
        </p>
      </div>
    </div>
  );
}

export default MainMenuScreen;
