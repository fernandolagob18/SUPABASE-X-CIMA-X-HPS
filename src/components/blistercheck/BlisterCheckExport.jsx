import { useState } from 'react';
import { Download, X, CheckCircle } from 'lucide-react';
import { getExportData } from '../../services/blistercheckService';

// Convierte un valor booleano/null a texto legible
function boolToStr(val) {
  if (val === true) return 'Sí';
  if (val === false) return 'No';
  return 'Sin clasificar';
}

// Formatea fecha ISO a texto legible
function formatFecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Escapa un campo para CSV (encierra en comillas si contiene coma, comilla o salto de línea)
function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(';') || str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsv(data) {
  const headers = [
    'nregistro',
    'cn',
    'nombre',
    'laboratorio',
    'dosis',
    'principio_activo',
    'forma_farmaceutica',
    'forma_simplificada',
    'via_administracion',
    'tipo_prescripcion',
    'requiere_reenvasado',
    'requiere_reetiquetado',
    'apto_sdmdu_blister',
    'solo_envase_clinico',
    'en_mi_farmacia',
    'notas',
    'fecha_clasificacion',
    'updated_at',
  ];

  const rows = data.map(row => {
    const cat = row.blistercheck_catalogo || {};
    return [
      cat.nregistro,
      cat.cn,
      cat.nombre,
      cat.laboratorio,
      cat.dosis,
      cat.principio_activo,
      cat.forma_farmaceutica,
      cat.forma_simplificada,
      cat.via_administracion,
      cat.tipo_prescripcion,
      boolToStr(row.requiere_reenvasado),
      boolToStr(row.requiere_reetiquetado),
      boolToStr(row.apto_sdmdu_blister),
      boolToStr(row.solo_envase_clinico),
      boolToStr(row.en_mi_farmacia),
      row.notas || '',
      formatFecha(row.fecha_clasificacion),
      formatFecha(row.updated_at),
    ].map(escapeCsvField).join(';');
  });

  return [headers.join(';'), ...rows].join('\n');
}

function downloadCsv(content, filename) {
  // BOM para que Excel abra correctamente caracteres especiales
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Diferimos la revocación para que el navegador tenga tiempo de iniciar la descarga
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function BlisterCheckExport({ onClose }) {
  const [modo, setModo] = useState('clasificados'); // 'clasificados' | 'mi_farmacia' | 'todos'
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(null);

  const handleExportar = async () => {
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const data = await getExportData(modo);
      if (data.length === 0) {
        setError('No hay datos para exportar con los filtros seleccionados.');
        setLoading(false);
        return;
      }
      const csv = generateCsv(data);
      const fecha = new Date().toISOString().split('T')[0];
      const sufijo = modo === 'mi_farmacia' ? '_mi_farmacia' : modo === 'todos' ? '_todos' : '';
      downloadCsv(csv, `BlisterCheck_export${sufijo}_${fecha}.csv`);
      setCount(data.length);
      setDone(true);
    } catch (err) {
      console.error('Error exportando:', err);
      setError('Error al exportar. Comprueba tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bc-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bc-modal glass-panel">
        {/* Cabecera */}
        <div className="bc-modal-header">
          <div className="bc-modal-title">
            <Download size={20} />
            <h3>Exportar datos BlisterCheck</h3>
          </div>
          <button className="bc-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="bc-modal-body">
          <p className="bc-modal-desc">
            Exporta los datos de clasificación a un archivo CSV compatible con Excel.
            Las columnas incluyen todos los campos de la base de datos.
          </p>

          <fieldset className="bc-export-options">
            <legend className="bc-export-legend">¿Qué datos exportar?</legend>

            <label className={`bc-export-option ${modo === 'clasificados' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="modo"
                value="clasificados"
                checked={modo === 'clasificados'}
                onChange={() => setModo('clasificados')}
              />
              <div>
                <strong>Solo clasificados</strong>
                <span>Medicamentos con al menos un campo de clasificación registrado</span>
              </div>
            </label>

            <label className={`bc-export-option ${modo === 'mi_farmacia' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="modo"
                value="mi_farmacia"
                checked={modo === 'mi_farmacia'}
                onChange={() => setModo('mi_farmacia')}
              />
              <div>
                <strong>Solo mi farmacia</strong>
                <span>Medicamentos marcados como "En mi farmacia"</span>
              </div>
            </label>

            <label className={`bc-export-option ${modo === 'todos' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="modo"
                value="todos"
                checked={modo === 'todos'}
                onChange={() => setModo('todos')}
              />
              <div>
                <strong>Todos con cualquier dato</strong>
                <span>Cualquier medicamento que tenga al menos una interacción guardada</span>
              </div>
            </label>
          </fieldset>

          <div className="bc-export-columns">
            <p className="bc-export-columns-label">Columnas incluidas:</p>
            <div className="bc-export-columns-grid">
              {[
                'nregistro', 'cn', 'nombre', 'laboratorio', 'dosis',
                'principio_activo', 'forma_farmaceutica', 'forma_simplificada',
                'via_administracion', 'tipo_prescripcion',
                'requiere_reenvasado', 'requiere_reetiquetado', 'apto_sdmdu_blister',
                'solo_envase_clinico', 'en_mi_farmacia', 'notas', 'fecha_clasificacion', 'updated_at'
              ].map(col => (
                <span key={col} className="bc-col-pill">{col}</span>
              ))}
            </div>
          </div>

          {error && <div className="bc-error" style={{ marginTop: '1rem' }}>{error}</div>}

          {done && (
            <div className="bc-export-success">
              <CheckCircle size={18} />
              {count} registros exportados correctamente.
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="bc-modal-footer">
          <button className="bc-btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="bc-btn-primary"
            onClick={handleExportar}
            disabled={loading}
          >
            {loading ? (
              <><div className="bc-mini-spinner" /> Exportando...</>
            ) : (
              <><Download size={16} /> Descargar CSV</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BlisterCheckExport;
