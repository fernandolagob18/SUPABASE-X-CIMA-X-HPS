import { ArrowLeft, AlertOctagon } from 'lucide-react';

function NioshApp({ onVolver }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', position: 'fixed', top: 0, left: 0, zIndex: 100, backgroundColor: 'var(--bg-body, #f8fafc)' }}>
      {/* Barra superior compartiendo estilos base del portal */}
      <div className="bc-topbar glass-panel" style={{ zIndex: 100, borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div className="bc-topbar__left">
          <button className="bc-back-btn" onClick={onVolver} title="Volver al menú principal">
            <ArrowLeft size={18} />
            <span>Volver al menú de inicio</span>
          </button>
          <div className="bc-logo" style={{ marginLeft: '1rem' }}>
            <AlertOctagon size={22} style={{ color: '#ef4444' }} />
            <span className="bc-logo__text" style={{ marginLeft: '0.5rem', fontWeight: 'bold', color: 'var(--text-main, #1e293b)' }}>Guía NIOSH 2024</span>
          </div>
        </div>
      </div>

      {/* Contenedor del Iframe */}
      <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        <iframe 
          src="/guia-niosh-2024.html" 
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="Guía NIOSH 2024"
        />
      </div>
    </div>
  );
}

export default NioshApp;
