import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Home, FileText, BookOpen, CheckCircle, XCircle, Circle, Save, Package, RefreshCw, Clock, HelpCircle, AlertTriangle, Calendar } from 'lucide-react';
import { saveClasificacion, getAlternativasSDMDU } from '../../services/blistercheckService';
import { isCriticalShortage } from '../../utils/shortageUtils';
import { formatDate } from '../../utils/dateUtils';

// ── Componente tristate: Sí / No / Sin clasificar ────────────────────────────
function TristateToggle({ label, descripcion, value, onChange }) {
  const opciones = [
    { val: true,  label: 'Sí',  cls: 'tristate--yes',     icon: <CheckCircle size={14} /> },
    { val: false, label: 'No',  cls: 'tristate--no',      icon: <XCircle size={14} /> },
    { val: null,  label: '—',   cls: 'tristate--neutral', icon: <Circle size={14} /> },
  ];

  return (
    <div className="bc-tristate-row">
      <div className="bc-tristate-info">
        <span className="bc-tristate-label">{label}</span>
        {descripcion && <span className="bc-tristate-desc">{descripcion}</span>}
      </div>
      <div className="bc-tristate-btns">
        {opciones.map(op => (
          <button
            key={String(op.val)}
            className={`bc-tristate-btn ${op.cls} ${value === op.val ? 'selected' : ''}`}
            onClick={() => onChange(op.val)}
          >
            {op.icon}
            {op.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MedicamentoDetalle({ medicamento, clasificacion, onClasificacionGuardada, onVolver, onSelectAlternativa, desabastecimiento }) {
  const [form, setForm] = useState({
    requiere_reenvasado:    clasificacion?.requiere_reenvasado    ?? null,
    requiere_reetiquetado:  clasificacion?.requiere_reetiquetado  ?? null,
    apto_sdmdu_blister:     clasificacion?.apto_sdmdu_blister     ?? null,
    solo_envase_clinico:    clasificacion?.solo_envase_clinico    ?? false,
    en_mi_farmacia:         clasificacion?.en_mi_farmacia         ?? false,
    notas:                  clasificacion?.notas                  ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Timestamp de la última actualización (viene de Supabase updated_at o fecha_clasificacion)
  const [ultimaActualizacion, setUltimaActualizacion] = useState(
    clasificacion?.updated_at || clasificacion?.fecha_clasificacion || null
  );

  const [alternativas, setAlternativas] = useState({ compatibles: [], pendientes: [] });
  const [loadingAlternativas, setLoadingAlternativas] = useState(false);

  // Actualizar form cuando cambia la clasificación (cargada asíncronamente)
  useEffect(() => {
    if (clasificacion) {
      setForm({
        requiere_reenvasado:    clasificacion.requiere_reenvasado    ?? null,
        requiere_reetiquetado:  clasificacion.requiere_reetiquetado  ?? null,
        apto_sdmdu_blister:     clasificacion.apto_sdmdu_blister     ?? null,
        solo_envase_clinico:    clasificacion.solo_envase_clinico    ?? false,
        en_mi_farmacia:         clasificacion.en_mi_farmacia         ?? false,
        notas:                  clasificacion.notas                  ?? '',
      });
      setUltimaActualizacion(clasificacion.updated_at || clasificacion.fecha_clasificacion || null);
    }
  }, [clasificacion]);

  // Cargar alternativas si requiere manipulación
  useEffect(() => {
    let isCurrent = true;

    if (form.requiere_reenvasado === true || form.requiere_reetiquetado === true) {
      setLoadingAlternativas(true);
      getAlternativasSDMDU(medicamento)
        .then(res => {
          if (isCurrent) setAlternativas(res);
        })
        .catch(err => {
          if (isCurrent) console.error("Error cargando alternativas", err);
        })
        .finally(() => {
          if (isCurrent) setLoadingAlternativas(false);
        });
    } else {
      setAlternativas({ compatibles: [], pendientes: [] });
    }

    return () => {
      isCurrent = false;
    };
  }, [form.requiere_reenvasado, form.requiere_reetiquetado, medicamento]);

  const handleChange = useCallback((campo, valor) => {
    setForm(prev => {
      const nuevo = { ...prev, [campo]: valor };
      
      // Exclusión mutua completa entre los tres estados principales
      if (valor === true) {
        if (campo === 'apto_sdmdu_blister') {
          nuevo.requiere_reenvasado = false;
          nuevo.requiere_reetiquetado = false;
        } else if (campo === 'requiere_reenvasado') {
          nuevo.apto_sdmdu_blister = false;
          nuevo.requiere_reetiquetado = false;
        } else if (campo === 'requiere_reetiquetado') {
          nuevo.apto_sdmdu_blister = false;
          nuevo.requiere_reenvasado = false;
        }
      }
      
      return nuevo;
    });
    setSavedOk(false);
  }, []);

  const handleToggle = useCallback((campo) => {
    setForm(prev => {
      const nuevoValor = !prev[campo];
      return { ...prev, [campo]: nuevoValor };
    });
    setSavedOk(false);
  }, []);

  const handleGuardar = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await saveClasificacion(medicamento.cn, form);  // clasificación por CN
      setSavedOk(true);
      const newDate = saved?.updated_at || saved?.fecha_clasificacion;
      if (newDate) setUltimaActualizacion(newDate);
      onClasificacionGuardada({ 
        cn: medicamento.cn,
        ...form,
        updated_at: saved?.updated_at,
        fecha_clasificacion: saved?.fecha_clasificacion
      });
      setTimeout(() => setSavedOk(false), 2000);
    } catch (err) {
      console.error('Error guardando clasificación:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      alert(`Error al guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [medicamento.cn, form, onClasificacionGuardada]);

  const fotoEnvase = medicamento.foto_envase_url;
  const fotoForma = medicamento.foto_forma_url;

  // Determinar si es candidato SDMDU por forma farmacéutica
  const esCandidatoSDMDU = ['COMPRIMIDO', 'CAPSULA'].some(f =>
    (medicamento.forma_simplificada || '').toUpperCase().includes(f)
  );

  return (
    <div className="bc-detalle">
      {/* Botón volver */}
      <button className="bc-detalle-back" onClick={onVolver}>
        <ArrowLeft size={16} /> Volver a resultados
      </button>

      <div className="bc-detalle-layout">
        {/* ── Columna izquierda: datos del medicamento ── */}
        <div className="bc-detalle-info glass-panel">
          {/* Imágenes */}
          {(fotoEnvase || fotoForma) && (
            <div className="bc-detalle-fotos">
              {fotoEnvase && (
                <div className="bc-foto-wrapper">
                  <img src={fotoEnvase} alt="Envase del medicamento" className="bc-foto-envase" loading="lazy" />
                  <span className="bc-foto-caption">Envase</span>
                </div>
              )}
              {fotoForma && (
                <div className="bc-foto-wrapper">
                  <img src={fotoForma} alt="Forma farmacéutica" className="bc-foto-forma" loading="lazy" />
                  <span className="bc-foto-caption">Forma farmacéutica</span>
                </div>
              )}
            </div>
          )}

          {/* Nombre */}
          <h2 className="bc-detalle-nombre">{medicamento.nombre}</h2>

          {esCandidatoSDMDU && (
            <div className="bc-candidate-hint">
              💊 Candidato para SDMDU por forma farmacéutica
            </div>
          )}

          {/* Datos */}
          <div className="bc-detalle-datos">
            <DataRow label="Nº Registro" value={medicamento.nregistro} mono />
            <DataRow label="Cód. Nacional" value={medicamento.cn || 'No disponible'} mono />
            <DataRow label="Laboratorio" value={medicamento.laboratorio} />
            <DataRow label="Dosis" value={medicamento.dosis} />
            <DataRow label="Principio activo" value={medicamento.principio_activo} />
            <DataRow label="Forma farmacéutica" value={medicamento.forma_farmaceutica} />
            <DataRow label="Forma simplificada" value={medicamento.forma_simplificada} />
            <DataRow label="Vía de administración" value={medicamento.via_administracion} />
            <DataRow label="Tipo de prescripción" value={medicamento.tipo_prescripcion} />
          </div>

          {/* Panel de desabastecimiento */}
          {desabastecimiento && <DesabastecimientoPanel shortage={desabastecimiento} />}

          {/* Links a documentación */}
          <div className="bc-detalle-docs">
            {medicamento.url_ficha_tecnica && (
              <a href={medicamento.url_ficha_tecnica} target="_blank" rel="noopener noreferrer" className="bc-doc-link">
                <FileText size={15} /> Ficha Técnica
                <ExternalLink size={12} />
              </a>
            )}
            {medicamento.url_prospecto && (
              <a href={medicamento.url_prospecto} target="_blank" rel="noopener noreferrer" className="bc-doc-link">
                <BookOpen size={15} /> Prospecto
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {/* ── Columna derecha: panel de clasificación ── */}
        <div className="bc-detalle-clasificacion glass-panel">
          <div className="bc-clas-header">
            <div className="bc-clas-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
            <h3 className="bc-clas-title">Clasificación BlisterCheck</h3>
          </div>

          <div className="bc-clas-body">
            <TristateToggle
              label="Requiere Reenvasado"
              descripcion="El envase original no es apto para dosis unitaria y debe ser reenvasado"
              value={form.requiere_reenvasado}
              onChange={v => handleChange('requiere_reenvasado', v)}
            />

            <TristateToggle
              label="Requiere Reetiquetado"
              descripcion="Necesita etiqueta adicional con nombre, lote o caducidad"
              value={form.requiere_reetiquetado}
              onChange={v => handleChange('requiere_reetiquetado', v)}
            />

            <TristateToggle
              label="Apto SDMDU (blíster OK)"
              descripcion="Blíster fraccionable correctamente identificado: nombre, lote y caducidad visibles"
              value={form.apto_sdmdu_blister}
              onChange={v => handleChange('apto_sdmdu_blister', v)}
            />

            {/* Separador */}
            <hr className="bc-clas-divider" />

            {/* Envase Clínico */}
            <div className="bc-farmacia-toggle" onClick={() => handleToggle('solo_envase_clinico')}>
              <div className="bc-farmacia-info">
                <Package size={16} className="bc-ec-icon" />
                <div>
                  <span className="bc-farmacia-label">
                    Envase Clínico
                    {form.solo_envase_clinico && (
                      <span className="bc-badge bc-badge--ec" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>EC</span>
                    )}
                  </span>
                  <span className="bc-farmacia-desc">La clasificación aplica únicamente al envase clínico (hospitalario)</span>
                </div>
              </div>
              <div className={`bc-toggle-switch ${form.solo_envase_clinico ? 'on-ec' : ''}`}>
                <div className="bc-toggle-thumb" />
              </div>
            </div>

            {/* Separador */}
            <hr className="bc-clas-divider" />

            {/* Mi farmacia */}
            <div className="bc-farmacia-toggle" onClick={() => handleToggle('en_mi_farmacia')}>
              <div className="bc-farmacia-info">
                <Home size={16} className="bc-farmacia-icon" />
                <div>
                  <span className="bc-farmacia-label">En mi farmacia</span>
                  <span className="bc-farmacia-desc">Usamos este medicamento en nuestra farmacia</span>
                </div>
              </div>
              <div className={`bc-toggle-switch ${form.en_mi_farmacia ? 'on' : ''}`}>
                <div className="bc-toggle-thumb" />
              </div>
            </div>

            {/* Separador */}
            <hr className="bc-clas-divider" />

            {/* Notas */}
            <div className="bc-notas-section">
              <label className="bc-notas-label">📝 Notas</label>
              <textarea
                className="bc-notas-input"
                placeholder="Observaciones, comentarios sobre el blíster, condiciones especiales..."
                value={form.notas}
                onChange={e => handleChange('notas', e.target.value)}
                rows={4}
              />
            </div>

            {/* Botón guardar */}
            <button
              className={`bc-guardar-btn ${savedOk ? 'saved' : ''}`}
              onClick={handleGuardar}
              disabled={saving}
            >
              {saving ? (
                <><div className="bc-mini-spinner" /> Guardando...</>
              ) : savedOk ? (
                <><CheckCircle size={16} /> ¡Guardado!</>
              ) : (
                <><Save size={16} /> Guardar clasificación</>
              )}
            </button>

            {/* Timestamp de última actualización */}
            <div className={`bc-last-update ${ultimaActualizacion ? 'bc-last-update--has-date' : 'bc-last-update--empty'}`}>
              <Clock size={13} className="bc-last-update-icon" />
              {ultimaActualizacion ? (
                <span>
                  Última actualización:{' '}
                  <strong>
                    {new Intl.DateTimeFormat('es-ES', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    }).format(new Date(ultimaActualizacion))}
                  </strong>
                </span>
              ) : (
                <span>Sin clasificar aún</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Nueva sección de alternativas ── */}
      {(form.requiere_reenvasado === true || form.requiere_reetiquetado === true) && (
        <div className="bc-alternativas-section glass-panel">
          <div className="bc-alternativas-header">
            <RefreshCw size={18} className="bc-alternativas-icon" />
            <h3>Alternativas compatibles con SDMDU</h3>
          </div>
          <p className="bc-alternativas-desc">
            Este medicamento requiere manipulación. Aquí tienes opciones equivalentes (mismo principio activo y dosis) que podrían ser aptas.
          </p>
          
          {loadingAlternativas ? (
            <div className="bc-loading-mini"><div className="bc-mini-spinner" /> Buscando alternativas...</div>
          ) : (alternativas.compatibles.length === 0 && alternativas.pendientes.length === 0) ? (
            <div className="bc-alternativas-empty">No se encontraron alternativas con el mismo principio activo y dosis.</div>
          ) : (
            <div className="bc-alternativas-list">
              {alternativas.compatibles.length > 0 && (
                <div className="bc-alternativas-group">
                  <h4 className="bc-alt-group-title compatible"><CheckCircle size={14} /> Compatibles comprobadas</h4>
                  <div className="bc-alt-cards">
                    {alternativas.compatibles.map(alt => (
                      <div key={alt.cn} className="bc-alt-card compatible" onClick={() => onSelectAlternativa && onSelectAlternativa(alt)}>
                        <span className="bc-alt-name">{alt.nombre}</span>
                        <span className="bc-alt-lab">{alt.laboratorio}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {alternativas.pendientes.length > 0 && (
                <div className="bc-alternativas-group">
                  <h4 className="bc-alt-group-title pendiente"><HelpCircle size={14} /> Pendientes de evaluar</h4>
                  <p className="bc-alt-group-desc">Estos medicamentos tienen las mismas características. ¡Anímate a probarlos para ver si son compatibles!</p>
                  <div className="bc-alt-cards">
                    {alternativas.pendientes.map(alt => (
                      <div key={alt.cn} className="bc-alt-card pendiente" onClick={() => onSelectAlternativa && onSelectAlternativa(alt)}>
                        <span className="bc-alt-name">{alt.nombre}</span>
                        <span className="bc-alt-lab">{alt.laboratorio}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DataRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="bc-data-row">
      <span className="bc-data-label">{label}</span>
      <span className={`bc-data-value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

// ── Panel de desabastecimiento ────────────────────────────────────────────────
function DesabastecimientoPanel({ shortage }) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = isCriticalShortage({ activo: 1, observ: shortage.observaciones });

  const hasLongObs = shortage.observaciones && shortage.observaciones.length > 220;
  const obsText = hasLongObs && !expanded
    ? `${shortage.observaciones.substring(0, 220)}...`
    : shortage.observaciones;

  const ffin = shortage.fecha_fin ? new Date(shortage.fecha_fin) : null;
  const sinFechaFin = !ffin || ffin.getFullYear() > 2040;

  return (
    <div className={`bc-shortage-panel ${isCritical ? 'bc-shortage-panel--critical' : 'bc-shortage-panel--warning'}`}>
      {/* Cabecera */}
      <div className="bc-shortage-panel__header">
        <AlertTriangle size={16} className="bc-shortage-panel__icon" />
        <span className="bc-shortage-panel__title">
          {isCritical ? 'Desabastecimiento Crítico Activo' : 'Desabastecimiento Activo'}
        </span>
        <span className={`bc-shortage-panel__pill ${isCritical ? 'pill--critical' : 'pill--warning'}`}>
          {isCritical ? '🚨 Crítico' : '⚠️ Activo'}
        </span>
      </div>

      {/* Nombre del desabastecimiento */}
      {shortage.nombre && (
        <p className="bc-shortage-panel__name">{shortage.nombre}</p>
      )}

      {/* Fechas */}
      <div className="bc-shortage-panel__dates">
        <span className="bc-shortage-date">
          <Calendar size={13} />
          <strong>Inicio:</strong>
          {shortage.fecha_inicio ? formatDate(shortage.fecha_inicio) : '—'}
        </span>
        <span className="bc-shortage-arrow">→</span>
        <span className="bc-shortage-date">
          <Calendar size={13} />
          <strong>Fin estimado:</strong>
          {sinFechaFin ? 'Sin fecha estimada' : formatDate(shortage.fecha_fin)}
        </span>
      </div>

      {/* Observaciones */}
      {shortage.observaciones && (
        <div className="bc-shortage-panel__obs">
          <p className="bc-shortage-obs-text" style={{ whiteSpace: 'pre-wrap' }}>{obsText}</p>
          {hasLongObs && (
            <button
              type="button"
              className="bc-shortage-expand-btn"
              onClick={() => setExpanded(prev => !prev)}
            >
              {expanded ? 'Ver menos ↑' : 'Ver más ↓'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MedicamentoDetalle;
