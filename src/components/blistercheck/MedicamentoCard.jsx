import { CheckCircle, AlertTriangle, Circle, Home, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getClasificacion } from '../../services/blistercheckService';

// Badge de clasificación reutilizable
function ClasificacionBadge({ clasificacion }) {
  if (!clasificacion) {
    return (
      <span className="bc-badge bc-badge--pending">
        <Circle size={11} /> Sin clasificar
      </span>
    );
  }

  const { apto_sdmdu_blister, requiere_reenvasado, requiere_reetiquetado, solo_envase_clinico } = clasificacion;
  const ecPill = solo_envase_clinico
    ? <span className="bc-badge bc-badge--ec" title="Aplica solo al envase clínico">EC</span>
    : null;

  if (apto_sdmdu_blister === true) {
    return (
      <>
        <span className="bc-badge bc-badge--apto">
          <CheckCircle size={11} /> Apto SDMDU
        </span>
        {ecPill}
      </>
    );
  }

  if (requiere_reenvasado === true || requiere_reetiquetado === true) {
    const partes = [];
    if (requiere_reenvasado) partes.push('Reenvasado');
    if (requiere_reetiquetado) partes.push('Reetiquetado');
    return (
      <>
        <span className="bc-badge bc-badge--intervencion">
          <AlertTriangle size={11} /> {partes.join(' + ')}
        </span>
        {ecPill}
      </>
    );
  }

  const sinClasificar = apto_sdmdu_blister === null && requiere_reenvasado === null && requiere_reetiquetado === null;

  if (sinClasificar) {
    return (
      <span className="bc-badge bc-badge--pending">
        <Circle size={11} /> Sin clasificar
      </span>
    );
  }

  // Si está clasificado pero no ha cumplido ninguna de las condiciones anteriores (todo es false o null)
  return (
    <>
      <span className="bc-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>
        <XCircle size={11} /> No Apto SDMDU
      </span>
      {ecPill}
    </>
  );
}

function MedicamentoCard({ medicamento, onClick }) {
  const [clasificacion, setClasificacion] = useState(undefined); // undefined = cargando

  useEffect(() => {
    let isCurrent = true;
    getClasificacion(medicamento.nregistro)
      .then(data => {
        if (isCurrent) setClasificacion(data);
      })
      .catch(() => {
        if (isCurrent) setClasificacion(null);
      });
    return () => { isCurrent = false; };
  }, [medicamento.nregistro]);

  const formaSimplificada = medicamento.forma_simplificada || medicamento.forma_farmaceutica;
  const esCandidatoSDMDU = ['COMPRIMIDO', 'CAPSULA'].some(f =>
    (medicamento.forma_simplificada || '').toUpperCase().includes(f)
  );

  return (
    <button className="bc-med-card glass-panel" onClick={onClick}>
      {/* Franja lateral de color según clasificación */}
      <div className={`bc-med-card__stripe ${
        clasificacion?.apto_sdmdu_blister === true ? 'stripe--apto' :
        (clasificacion?.requiere_reenvasado === true || clasificacion?.requiere_reetiquetado === true) ? 'stripe--intervencion' :
        (!clasificacion || (clasificacion.apto_sdmdu_blister === null && clasificacion.requiere_reenvasado === null && clasificacion.requiere_reetiquetado === null)) ? 'stripe--pending' :
        'stripe--no-apto'
      }`} />

      <div className="bc-med-card__body">
        {/* Cabecera */}
        <div className="bc-med-card__header">
          <div className="bc-med-card__meta">
            {medicamento.cn && (
              <span className="bc-cn-badge">CN {medicamento.cn}</span>
            )}
            {esCandidatoSDMDU && !clasificacion && (
              <span className="bc-candidate-badge">Candidato SDMDU</span>
            )}
          </div>
          <div className="bc-med-card__badges">
            {clasificacion !== undefined && <ClasificacionBadge clasificacion={clasificacion} />}
            {clasificacion?.en_mi_farmacia && (
              <span className="bc-badge bc-badge--farmacia">
                <Home size={10} /> Mi farmacia
              </span>
            )}
          </div>
        </div>

        {/* Nombre */}
        <h3 className="bc-med-card__nombre">{medicamento.nombre}</h3>

        {/* Detalles */}
        <div className="bc-med-card__details">
          <span className="bc-med-detail">
            <span className="bc-med-detail__label">Lab:</span>
            {medicamento.laboratorio || '—'}
          </span>
          {medicamento.dosis && (
            <span className="bc-med-detail">
              <span className="bc-med-detail__label">Dosis:</span>
              {medicamento.dosis}
            </span>
          )}
          {formaSimplificada && (
            <span className="bc-med-detail">
              <span className="bc-med-detail__label">Forma:</span>
              {formaSimplificada}
            </span>
          )}
          {medicamento.principio_activo && (
            <span className="bc-med-detail">
              <span className="bc-med-detail__label">P. activo:</span>
              {medicamento.principio_activo}
            </span>
          )}
          {clasificacion && (clasificacion.updated_at || clasificacion.fecha_clasificacion) && (
            <span className="bc-med-detail">
              <span className="bc-med-detail__label">Actualizado:</span>
              {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(clasificacion.updated_at || clasificacion.fecha_clasificacion))}
            </span>
          )}
        </div>
      </div>

      <div className="bc-med-card__arrow">›</div>
    </button>
  );
}

export default MedicamentoCard;
export { ClasificacionBadge };
