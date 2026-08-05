import { useState, useEffect } from 'react';
import { BarChart2, Trophy, TrendingUp, Home } from 'lucide-react';
import { getEstadisticasPorLaboratorio, getCatalogInfo } from '../../services/blistercheckService';

const MEDALLAS = ['🥇', '🥈', '🥉'];

function ScoreBar({ score }) {
  const color = score >= 75 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="bc-score-bar-wrap" title={`${score}% aptos directamente`}>
      <div className="bc-score-bar-track">
        <div
          className="bc-score-bar-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="bc-score-num" style={{ color }}>{score}%</span>
    </div>
  );
}

function BlisterCheckStats() {
  const [stats, setStats] = useState([]);
  const [catalogInfo, setCatalogInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [soloMiFarmacia, setSoloMiFarmacia] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    Promise.all([
      getEstadisticasPorLaboratorio(soloMiFarmacia),
      getCatalogInfo(),
    ])
      .then(([statsData, info]) => {
        if (isCurrent) {
          setStats(statsData);
          setCatalogInfo(info);
          setError(null);
        }
      })
      .catch(() => {
        if (isCurrent) setError('Error cargando estadísticas.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [soloMiFarmacia]);

  const totalAptos = stats.reduce((s, r) => s + r.aptos_directos, 0);
  const totalIntervencion = stats.reduce((s, r) => s + r.requieren_intervencion, 0);
  const totalClasificados = stats.reduce((s, r) => s + r.total_clasificados, 0);

  return (
    <div className="bc-stats">
      {/* ── Cabecera ── */}
      <div className="bc-stats-header glass-panel">
        <div className="bc-stats-title-row">
          <BarChart2 size={22} className="bc-stats-icon" />
          <h2 className="bc-stats-title">Estadísticas BlisterCheck</h2>
        </div>

        <label className="bc-farmacia-filter">
          <div
            className={`bc-toggle-switch ${soloMiFarmacia ? 'on' : ''}`}
            onClick={() => setSoloMiFarmacia(p => !p)}
          >
            <div className="bc-toggle-thumb" />
          </div>
          <Home size={15} />
          <span>Solo mis medicamentos</span>
        </label>
      </div>

      {/* ── Resumen global ── */}
      {catalogInfo && (
        <div className="bc-stats-summary">
          <div className="bc-summary-card glass-panel">
            <span className="bc-summary-num">{catalogInfo.totalCatalogo.toLocaleString('es-ES')}</span>
            <span className="bc-summary-label">En catálogo</span>
          </div>
          <div className="bc-summary-card glass-panel">
            <span className="bc-summary-num">{catalogInfo.totalClasificados}</span>
            <span className="bc-summary-label">Clasificados</span>
          </div>
          <div className="bc-summary-card glass-panel bc-summary-card--green">
            <span className="bc-summary-num">{totalAptos}</span>
            <span className="bc-summary-label">Aptos SDMDU directos</span>
          </div>
          <div className="bc-summary-card glass-panel bc-summary-card--amber">
            <span className="bc-summary-num">{totalIntervencion}</span>
            <span className="bc-summary-label">Requieren intervención</span>
          </div>
          <div className="bc-summary-card glass-panel bc-summary-card--blue">
            <span className="bc-summary-num">{catalogInfo.enMiFarmacia}</span>
            <span className="bc-summary-label">En mi farmacia</span>
          </div>
          <div className="bc-summary-card glass-panel bc-summary-card--red">
            <span className="bc-summary-num">
              {(catalogInfo.totalCatalogo - catalogInfo.totalClasificados).toLocaleString('es-ES')}
            </span>
            <span className="bc-summary-label">Sin clasificar</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="bc-loading" style={{ marginTop: '3rem' }}>
          <div className="bc-spinner" />
          <span>Calculando estadísticas...</span>
        </div>
      )}

      {error && !loading && (
        <div className="bc-error glass-panel">{error}</div>
      )}

      {!loading && !error && stats.length === 0 && (
        <div className="bc-empty glass-panel" style={{ marginTop: '2rem' }}>
          <TrendingUp size={36} opacity={0.3} />
          <p>No hay datos suficientes para mostrar estadísticas.</p>
          <p className="bc-empty-hint">Clasifica al menos un medicamento para ver estadísticas por laboratorio.</p>
        </div>
      )}

      {!loading && stats.length > 0 && (
        <>
          {/* ── Top 3 laboratorios ── */}
          {stats.length >= 3 && (
            <div className="bc-podium glass-panel">
              <div className="bc-podium-header">
                <Trophy size={18} />
                <h3>Top Laboratorios — Score SDMDU</h3>
              </div>
              <div className="bc-podium-grid">
                {stats.slice(0, 3).map((lab, i) => (
                  <div key={lab.laboratorio} className={`bc-podium-item bc-podium-item--${i + 1}`}>
                    <span className="bc-podium-medal">{MEDALLAS[i]}</span>
                    <span className="bc-podium-lab">{lab.laboratorio}</span>
                    <span className="bc-podium-score">{lab.score_sdmdu}%</span>
                    <span className="bc-podium-detail">{lab.aptos_directos}/{lab.total_clasificados} aptos</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tabla completa ── */}
          <div className="bc-stats-table-wrap glass-panel">
            <h3 className="bc-table-title">Ranking por Laboratorio</h3>
            <div className="bc-stats-table-scroll">
              <table className="bc-stats-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Laboratorio</th>
                    <th>Clasificados</th>
                    <th>Aptos directos</th>
                    <th>Con intervención</th>
                    <th>Score SDMDU</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((lab, i) => (
                    <tr key={lab.laboratorio} className={i < 3 ? 'bc-table-row--top' : ''}>
                      <td className="bc-table-rank">
                        {i < 3 ? MEDALLAS[i] : i + 1}
                      </td>
                      <td className="bc-table-lab">{lab.laboratorio}</td>
                      <td className="bc-table-num">{lab.total_clasificados}</td>
                      <td className="bc-table-num bc-table-num--green">{lab.aptos_directos}</td>
                      <td className="bc-table-num bc-table-num--amber">{lab.requieren_intervencion}</td>
                      <td className="bc-table-score">
                        <ScoreBar score={lab.score_sdmdu} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {catalogInfo?.ultimaSync && (
              <p className="bc-stats-sync-info">
                Última sincronización del catálogo: {new Date(catalogInfo.ultimaSync).toLocaleDateString('es-ES', {
                  day: '2-digit', month: 'long', year: 'numeric'
                })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default BlisterCheckStats;
