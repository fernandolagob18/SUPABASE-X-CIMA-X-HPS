import React, { useState } from 'react';
import { Calculator, ShoppingCart, ArrowLeft } from 'lucide-react';
import AnalisisConsumos from './AnalisisConsumos';
import AnalisisCompras from './AnalisisCompras';

function AnalisisEconomicoApp({ onVolver }) {
  const [vistaActiva, setVistaActiva] = useState('menu'); // 'menu', 'consumos', 'compras'

  if (vistaActiva === 'consumos') {
    return <AnalisisConsumos onVolver={() => setVistaActiva('menu')} />;
  }

  if (vistaActiva === 'compras') {
    return <AnalisisCompras onVolver={() => setVistaActiva('menu')} />;
  }

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '2rem' }}>
        <button
          onClick={onVolver}
          className="bc-back-btn"
          title="Volver al menú principal"
        >
          <ArrowLeft size={18} style={{ marginRight: '0.4rem' }} />
          Volver al menú de inicio
        </button>
      </div>

      <div className="ae-container">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem', color: 'var(--color-text)', marginBottom: '0.5rem' }}>Análisis Económico</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem' }}>Selecciona el tipo de análisis que deseas realizar</p>
        </div>

        <div className="ae-menu-grid">
          {/* Tarjeta Consumos */}
          <button
            className="module-card"
            onClick={() => setVistaActiva('consumos')}
            style={{ borderColor: 'rgba(13, 148, 136, 0.2)' }}
          >
            <div className="module-card__icon" style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', color: '#0d9488' }}>
              <Calculator size={36} />
            </div>
            <div className="module-card__content">
              <h2 className="module-card__title">Análisis de Consumos por Servicio</h2>
              <p className="module-card__desc">
                Calcula el gasto económico sin IVA desglosado por servicio o unidad destino a partir de los consumos.
              </p>
            </div>
            <div className="module-card__arrow">→</div>
          </button>

          {/* Tarjeta Compras */}
          <button
            className="module-card"
            onClick={() => setVistaActiva('compras')}
            style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}
          >
            <div className="module-card__icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
              <ShoppingCart size={36} />
            </div>
            <div className="module-card__content">
              <h2 className="module-card__title">Análisis de Compras</h2>
              <p className="module-card__desc">
                Calcula el gasto total con IVA realizado por Farmacia, desglosado por proveedor a partir de un listado de compras.
              </p>
            </div>
            <div className="module-card__arrow">→</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AnalisisEconomicoApp;
