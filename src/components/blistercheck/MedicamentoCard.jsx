import { CheckCircle, AlertTriangle, Circle, Home } from 'lucide-react';
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

  const { apto_sdmdu_blister, requiere_reenvasado, requiere_reetiquetado } = clasificacion;

  if (apto_sdmdu_blister === true) {
    return (
      <span className="bc-badge bc-badge--apto">
        <CheckCircle size={11} /> Apto SDMDU
      </span>
    );
  }

  if (requiere_reenvasado === true || requiere_reetiquetado === true) {
    const partes = [];
    if (requiere_reenvasado) partes.push('Reenvasado');
    if (requiere_reetiquetado) partes.push('Reetiquetado');
    return (
      <span className="bc-badge bc-badge--intervencion">
        <AlertTriangle size={11} /> {partes.join(' + ')}
      </span>
    );
  }

  return (
    <span className="bc-badge bc-badge--pending">
      <Circle size={11} /> Sin clasificar
    </span>
  );
}

function MedicamentoCard({ medicamento, onClick }) {
  const [clasificacion, setClasificacion] = useState(undefined); // undefined = cargando

  useEffect(() => {
    getClasificacion(medicamento.nregistro)
      .then(setClasificacion)
      .catch(() => setClasificacion(null));
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
        'stripe--pending'
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
        </div>
      </div>

      <div className="bc-med-card__arrow">›</div>
    </button>
  );
}

export default MedicamentoCard;
export { ClasificacionBadge };
