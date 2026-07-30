import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Plus, Search, X, Pencil, Trash2, CheckCircle, PackageOpen, AlertCircle, Euro } from 'lucide-react';
import { getLaboratorios, saveLaboratorio, deleteLaboratorio } from '../../services/pedidosMinimosService';

// ─── Utilidades ───────────────────────────────────────────────────────────────

const norm = str => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function formatEur(value) {
  if (value === null || value === undefined) return null;
  return Number(value).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─── Modal de creación / edición ──────────────────────────────────────────────

function LaboratorioModal({ inicial, onGuardar, onCerrar, saving }) {
  const [laboratorio, setLaboratorio] = useState(inicial?.laboratorio || '');
  const [minimo, setMinimo] = useState(
    inicial?.minimo_eur !== null && inicial?.minimo_eur !== undefined ? String(inicial.minimo_eur) : ''
  );
  const [notas, setNotas] = useState(inicial?.notas || '');
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!laboratorio.trim()) { setErr('El nombre del laboratorio es obligatorio.'); return; }
    if (minimo !== '' && (isNaN(Number(minimo)) || Number(minimo) < 0)) {
      setErr('El importe mínimo debe ser un número positivo, o déjalo vacío para sin mínimo.');
      return;
    }
    setErr('');
    onGuardar({ id: inicial?.id, laboratorio, minimo_eur: minimo, notas });
  };

  return (
    <div className="pm-modal-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="pm-modal">
        <div className="pm-modal-header">
          <h3>{inicial?.id ? 'Editar laboratorio' : 'Nuevo laboratorio'}</h3>
          <button className="pm-modal-close" onClick={onCerrar}><X size={18} /></button>
        </div>
        <form className="pm-modal-body" onSubmit={handleSubmit}>
          <div className="pm-field">
            <label className="pm-label">Nombre del laboratorio *</label>
            <input
              ref={inputRef}
              className="pm-input"
              placeholder="Ej: CINFA"
              value={laboratorio}
              onChange={e => setLaboratorio(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="pm-field">
            <label className="pm-label">Pedido mínimo (€ sin IVA)</label>
            <div className="pm-input-eur-wrap">
              <Euro size={15} className="pm-eur-icon" />
              <input
                className="pm-input pm-input--eur"
                type="number"
                min="0"
                step="0.01"
                placeholder="Dejar vacío = sin mínimo"
                value={minimo}
                onChange={e => setMinimo(e.target.value)}
                disabled={saving}
              />
            </div>
            <span className="pm-field-hint">Si no hay importe mínimo, deja el campo vacío.</span>
          </div>
          <div className="pm-field">
            <label className="pm-label">Notas (opcional)</label>
            <textarea
              className="pm-input pm-textarea"
              placeholder="Observaciones adicionales..."
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              disabled={saving}
            />
          </div>
          {err && <div className="pm-form-error"><AlertCircle size={14} />{err}</div>}
          <div className="pm-modal-footer">
            <button type="button" className="pm-btn-secondary" onClick={onCerrar} disabled={saving}>Cancelar</button>
            <button type="submit" className="pm-btn-primary" disabled={saving}>
              {saving ? <><div className="pm-mini-spinner" /> Guardando...</> : <><CheckCircle size={15} /> Guardar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tarjeta de laboratorio ───────────────────────────────────────────────────

function LaboratorioCard({ lab, onEditar, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false);
  const tieneMinimo = lab.minimo_eur !== null && lab.minimo_eur !== undefined;

  return (
    <div className={`pm-card ${tieneMinimo ? 'pm-card--con-minimo' : 'pm-card--sin-minimo'}`}>
      <div className="pm-card-stripe" />
      <div className="pm-card-body">
        <div className="pm-card-top">
          <span className="pm-card-nombre">{lab.laboratorio}</span>
          <div className="pm-card-actions">
            <button className="pm-action-btn pm-action-btn--edit" title="Editar" onClick={() => onEditar(lab)}>
              <Pencil size={14} />
            </button>
            {!confirmando ? (
              <button className="pm-action-btn pm-action-btn--delete" title="Eliminar" onClick={() => setConfirmando(true)}>
                <Trash2 size={14} />
              </button>
            ) : (
              <div className="pm-confirm-delete">
                <span className="pm-confirm-text">¿Eliminar?</span>
                <button className="pm-confirm-btn pm-confirm-btn--yes" onClick={() => onEliminar(lab.id)}>Sí</button>
                <button className="pm-confirm-btn pm-confirm-btn--no" onClick={() => setConfirmando(false)}>No</button>
              </div>
            )}
          </div>
        </div>

        <div className="pm-card-badge-row">
          {tieneMinimo ? (
            <span className="pm-badge pm-badge--minimo">
              <Euro size={11} />
              {formatEur(lab.minimo_eur)} € mín.
            </span>
          ) : (
            <span className="pm-badge pm-badge--sin-minimo">Sin pedido mínimo</span>
          )}
        </div>

        {lab.notas && <p className="pm-card-notas">{lab.notas}</p>}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function PedidosMinimosApp({ onVolver }) {
  const [laboratorios, setLaboratorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [tab, setTab] = useState('todos'); // 'todos' | 'con' | 'sin'
  const [modal, setModal] = useState(null); // null | { lab? }
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLaboratorios();
      setLaboratorios(data);
    } catch (e) {
      setError('Error al cargar los laboratorios. Comprueba tu conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleGuardar = async (datos) => {
    setSaving(true);
    try {
      await saveLaboratorio(datos);
      await cargar();
      setModal(null);
      showToast(datos.id ? 'Laboratorio actualizado ✓' : 'Laboratorio creado ✓');
    } catch (e) {
      alert('Error al guardar: ' + (e.message || 'inténtalo de nuevo'));
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id) => {
    try {
      await deleteLaboratorio(id);
      setLaboratorios(prev => prev.filter(l => l.id !== id));
      showToast('Laboratorio eliminado');
    } catch (e) {
      alert('Error al eliminar: ' + (e.message || 'inténtalo de nuevo'));
    }
  };

  // Filtrado
  const filtrados = laboratorios.filter(lab => {
    const matchBusqueda = norm(lab.laboratorio).includes(norm(busqueda));
    const tieneMinimo = lab.minimo_eur !== null && lab.minimo_eur !== undefined;
    if (tab === 'con' && !tieneMinimo) return false;
    if (tab === 'sin' && tieneMinimo) return false;
    return matchBusqueda;
  });

  const conMinimo = laboratorios.filter(l => l.minimo_eur !== null && l.minimo_eur !== undefined).length;
  const sinMinimo = laboratorios.length - conMinimo;

  return (
    <div className="pm-app">
      {/* ── Cabecera ── */}
      <div className="pm-header glass-panel">
        <div className="pm-header-left">
          <button className="pm-back-btn" onClick={onVolver}>
            <ArrowLeft size={16} /> Volver al menú
          </button>
          <div className="pm-header-title-wrap">
            <div className="pm-header-icon">
              <PackageOpen size={22} />
            </div>
            <div>
              <h1 className="pm-title">Pedidos Mínimos</h1>
              <p className="pm-subtitle">Importes mínimos de compra por laboratorio (sin IVA)</p>
            </div>
          </div>
        </div>
        <button className="pm-btn-add" onClick={() => setModal({})}>
          <Plus size={16} /> Añadir laboratorio
        </button>
      </div>

      {/* ── Barra de búsqueda + Tabs ── */}
      <div className="pm-controls glass-panel">
        <div className="pm-search-wrap">
          <Search size={16} className="pm-search-icon" />
          <input
            className="pm-search-input"
            placeholder="Buscar laboratorio..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="pm-search-clear" onClick={() => setBusqueda('')}><X size={14} /></button>
          )}
        </div>
        <div className="pm-tabs">
          <button className={`pm-tab ${tab === 'todos' ? 'active' : ''}`} onClick={() => setTab('todos')}>
            Todos <span className="pm-tab-count">{laboratorios.length}</span>
          </button>
          <button className={`pm-tab pm-tab--con ${tab === 'con' ? 'active' : ''}`} onClick={() => setTab('con')}>
            Con mínimo <span className="pm-tab-count">{conMinimo}</span>
          </button>
          <button className={`pm-tab pm-tab--sin ${tab === 'sin' ? 'active' : ''}`} onClick={() => setTab('sin')}>
            Sin mínimo <span className="pm-tab-count">{sinMinimo}</span>
          </button>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="pm-content">
        {loading && (
          <div className="pm-loading">
            <div className="pm-spinner" />
            <span>Cargando laboratorios...</span>
          </div>
        )}

        {error && !loading && (
          <div className="pm-error glass-panel">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {!loading && !error && filtrados.length === 0 && (
          <div className="pm-empty glass-panel">
            <PackageOpen size={40} opacity={0.25} />
            <p>{busqueda ? 'No hay laboratorios que coincidan con la búsqueda.' : 'No hay laboratorios en esta categoría.'}</p>
          </div>
        )}

        {!loading && !error && filtrados.length > 0 && (
          <>
            <p className="pm-results-count">
              {filtrados.length} laboratorio{filtrados.length !== 1 ? 's' : ''}
              {busqueda && ` para "${busqueda}"`}
            </p>
            <div className="pm-grid">
              {filtrados.map(lab => (
                <LaboratorioCard
                  key={lab.id}
                  lab={lab}
                  onEditar={l => setModal({ lab: l })}
                  onEliminar={handleEliminar}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {modal !== null && (
        <LaboratorioModal
          inicial={modal.lab || null}
          onGuardar={handleGuardar}
          onCerrar={() => setModal(null)}
          saving={saving}
        />
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="pm-toast">
          <CheckCircle size={15} /> {toastMsg}
        </div>
      )}
    </div>
  );
}

export default PedidosMinimosApp;
