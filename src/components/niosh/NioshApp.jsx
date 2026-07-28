import { useEffect } from 'react';

function NioshApp({ onVolver }) {
  useEffect(() => {
    const handleMessage = (event) => {
      // Por seguridad, aunque estemos en la misma ventana, comprobamos los datos
      if (event.data === 'volver_inicio') {
        onVolver();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onVolver]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 100, backgroundColor: 'var(--bg-body, #f8fafc)', overflow: 'hidden' }}>
      <iframe 
        src="/guia-niosh-2024.html" 
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Guía NIOSH 2024"
      />
    </div>
  );
}

export default NioshApp;
