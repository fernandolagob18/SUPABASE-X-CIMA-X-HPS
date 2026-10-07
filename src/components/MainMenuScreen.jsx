import { Pill, AlertOctagon, PackageOpen, Calculator } from 'lucide-react';

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
          {/* Guía NIOSH 2024 */}
          <button
            className="module-card module-card--niosh"
            onClick={() => onSelectModule('niosh')}
          >
            <div className="module-card__icon module-card__icon--niosh">
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

          {/* Análisis Económico */}
          <button
            className="module-card module-card--economico"
            onClick={() => onSelectModule('analisiseconomico')}
          >
            <div className="module-card__icon module-card__icon--economico">
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
              </div>
            </div>
            <div className="module-card__arrow">→</div>
          </button>
        </div>

        <p className="main-menu-footer">
          HPS Suite — Servicio de Farmacia Hospitalaria
        </p>
      </div>
    </div>
  );
}

export default MainMenuScreen;
