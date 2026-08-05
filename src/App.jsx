
import { useState, useEffect, useMemo, useCallback } from 'react';
import './index.css';
import './blistercheck.css';
import './pedidos.css';
import './analisiseconomico.css';
import { supabase } from './lib/supabase';
import Header from './components/Header';
import Filters from './components/Filters';
import ShortageList from './components/ShortageList';
import CatalogUpload from './components/CatalogUpload';
import EmailConfig from './components/EmailConfig';
import { isCriticalShortage } from './utils/shortageUtils';
import ErrorBoundary from './components/ErrorBoundary';
import LoginScreen from './components/LoginScreen';
import MainMenuScreen from './components/MainMenuScreen';
import BlisterCheckApp from './components/blistercheck/BlisterCheckApp';
import NioshApp from './components/niosh/NioshApp';
import PedidosMinimosApp from './components/pedidosminimos/PedidosMinimosApp';
import AnalisisEconomicoApp from './components/analisiseconomico/AnalisisEconomicoApp';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeModule, setActiveModule] = useState('menu'); // 'menu' | 'cimawatch' | 'blistercheck'
  const [userEmail, setUserEmail] = useState('');

  // Inicialización de sesión al cargar la página
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Preguntar a Supabase si tiene sesión válida.
        //    getSession() renueva el access_token internamente si ha expirado
        //    pero el refresh_token sigue vigente (dura semanas por defecto).
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          // 2. Actualizar la cookie con el token fresco antes de llamar al servidor.
          //    Así check-auth siempre recibe un token válido, incluso tras días sin abrir la app.
          document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=2592000; SameSite=Lax; Secure`;

          // 3. Validar contra el middleware del servidor (ahora sí con cookie fresca)
          const res = await fetch('/api/check-auth');
          if (res.ok) {
            setIsAuthenticated(true);
            setUserEmail(session.user?.email || '');
          } else {
            setIsAuthenticated(false);
          }
        } else {
          // No hay sesión activa en Supabase → mostrar pantalla de login
          setIsAuthenticated(false);
        }
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();

    // Mantener la cookie sincronizada durante el uso activo de la app.
    // Se dispara cuando Supabase renueva el token en segundo plano (~cada hora).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session?.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=2592000; SameSite=Lax; Secure`;
      }
      if (event === 'SIGNED_OUT') {
        document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure`;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [shortages, setShortages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [catalogCNs, setCatalogCNs] = useState(new Set());
  const [managedCNs, setManagedCNs] = useState(new Set());
  const [notes, setNotes] = useState({});

  const handleLogout = async () => {
    try {
      // Cerrar sesión en el servidor (borra cookie de sesión del servidor)
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error', e);
    }
    // Cerrar sesión en Supabase (borra refresh_token de localStorage).
    // Sin esto, getSession() recuperaría la sesión automáticamente al recargar.
    await supabase.auth.signOut();
    // Limpiar estado local de la app
    setIsAuthenticated(false);
    setActiveModule('menu');
    setUserEmail('');
    setShortages([]);
    setCatalogCNs(new Set());
    setManagedCNs(new Set());
    setNotes({});
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showCatalogOnly, setShowCatalogOnly] = useState(false);

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Auto-enable filter if catalog was loaded from storage
  useEffect(() => {
    if (catalogCNs.size > 0) {
      // Keep filter off by default on load
    }
  }, []);

  /* 
     Load ALL data at once. 
     Pagination is handled internally by the service now. 
     This ensures Search and Catalog Matching work on the full dataset.
  */
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadProgress({ current: 1, total: 100 });

    const fetchAllRecords = async (table, select = '*') => {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        page++;
      }
      return allData;
    };

    try {
      // Parallelize the 3 large table fetches
      const [dbShortages, catData, segData] = await Promise.all([
        fetchAllRecords('desabastecimientos_activos', '*'),
        fetchAllRecords('catalogo_hospital', 'cn'),
        fetchAllRecords('seguimiento_medicamentos', '*')
      ]);

      // Mapear de vuelta al formato que espera el UI
      const formattedShortages = (dbShortages || []).map(row => ({
        cn: row.cn,
        normalizedCN: String(row.cn),
        nombre: row.nombre,
        observ: row.observaciones,
        fini: row.fecha_inicio,
        ffin: row.fecha_fin,
        activo: 1, // Si está en la BBDD es porque está activo
        criticidad: row.criticidad
      }));

      // Force CNs to String to ensure Set.has() works correctly later when comparing with strings
      const newCatSet = new Set(catData.map(c => String(c.cn)));
      setCatalogCNs(newCatSet);

      const newManagedSet = new Set();
      const newNotesObj = {};

      segData.forEach(row => {
        if (row.estado_gestion) newManagedSet.add(String(row.cn));
        if (row.notas_seguimiento) newNotesObj[String(row.cn)] = row.notas_seguimiento;
      });

      setManagedCNs(newManagedSet);
      setNotes(newNotesObj);
      setShortages(formattedShortages);

      if (newCatSet.size > 0) {
        setShowCatalogOnly(true);
      }

    } catch (err) {
      console.error(err);
      setError('Error al conectar con la base de datos compartida. Revisa tu conexión.');
    } finally {
      setLoading(false);
      setLoadProgress({ current: 0, total: 0 });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handleCatalogLoaded = async (cnSet) => {
    // Si el set está vacío es porque borraron o falló, el componente hijo lo maneja
    if (cnSet.size === 0) {
      setCatalogCNs(new Set());
      setShowCatalogOnly(false);
      return;
    }

    // Almacena localmente para la sesión actual
    setCatalogCNs(cnSet);
    setShowCatalogOnly(true);
  };

  const handleClearCatalog = async () => {
    if (window.confirm("¿Seguro que quieres borrar el catálogo actual de la base de datos compartida?")) {
      try {
        // Delete API
        const response = await fetch('/api/update-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catalogCNs: [], borrarTodo: true })
        });
        
        if (!response.ok) {
          throw new Error('Error en el servidor al intentar borrar el catálogo');
        }

        setCatalogCNs(new Set());
        setShowCatalogOnly(false);
      } catch (e) {
        alert("Error al intentar borrar el catálogo");
      }
    }
  };

  const toggleManaged = useCallback(async (cn) => {
    const isNowManaged = !managedCNs.has(cn);

    // Optistic UI update
    setManagedCNs(prev => {
      const next = new Set(prev);
      if (next.has(cn)) next.delete(cn);
      else next.add(cn);
      return next;
    });

    try {
      await supabase
        .from('seguimiento_medicamentos')
        .upsert({
          cn: String(cn),
          estado_gestion: isNowManaged,
          notas_seguimiento: notes[cn] || null
        });
    } catch (err) {
      console.error("Failed to sync managed state", err);
      // We could revert optimistic update here
    }
  }, [managedCNs, notes]);

  const updateNote = useCallback(async (cn, text) => {
    const newText = (!text || text.trim() === '') ? null : text;

    // Optimistic UI Update
    setNotes(prev => {
      const next = { ...prev };
      if (!newText) delete next[cn];
      else next[cn] = newText;
      return next;
    });

    try {
      await supabase
        .from('seguimiento_medicamentos')
        .upsert({
          cn: String(cn),
          estado_gestion: managedCNs.has(cn),
          notas_seguimiento: newText
        });
    } catch (err) {
      console.error("Failed to sync note state", err);
    }
  }, [managedCNs]);



  // Derived state for filtered list
  const filteredShortages = useMemo(() => {
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    return shortages.map(item => {
      const rawCN = item.cn || item.nregistro;
      const numericString = rawCN ? String(rawCN).replace(/\D/g, '') : '';
      const apiCN = numericString.length >= 6 ? numericString.substring(0, 6) : numericString;

      return {
        ...item,
        normalizedCN: apiCN,
        inCatalog: catalogCNs.has(apiCN)
      };
    }).filter(item => {
      const startMs = Number(item.fini);
      let hasIndefiniteEnd = false;

      if (!item.ffin) {
        hasIndefiniteEnd = true;
      } else {
        const endYear = new Date(item.ffin).getFullYear();
        if (endYear > 2040) hasIndefiniteEnd = true;
      }

      if (startMs && (now - startMs > oneYearMs) && hasIndefiniteEnd) {
        return false;
      }

      const trimmedQuery = debouncedSearchQuery.trim();
      const lowerQuery = trimmedQuery.toLowerCase();
      const normalizedQuery = trimmedQuery.replace(/\D/g, '');

      const nameMatch = item.nombre && item.nombre.toLowerCase().includes(lowerQuery);

      const cnMatch = (item.nregistro && String(item.nregistro).startsWith(trimmedQuery)) ||
        (item.cn && String(item.cn).startsWith(trimmedQuery));

      const normalizedCnMatch = item.normalizedCN && normalizedQuery && item.normalizedCN.startsWith(normalizedQuery);

      if (!nameMatch && !cnMatch && !normalizedCnMatch) return false;

      if (showCatalogOnly && !item.inCatalog) {
        return false;
      }

      if (showCriticalOnly) {
        return isCriticalShortage(item);
      }

      return true;
    }).sort((a, b) => {
      // Ordenar por fecha de inicio (fini) de más reciente a más antigua
      const timeA = Number(a.fini) || 0;
      const timeB = Number(b.fini) || 0;
      return timeB - timeA;
    });
  }, [shortages, debouncedSearchQuery, showCriticalOnly, catalogCNs, showCatalogOnly]);

  // Match counter: we count how many items from the base shortages belong to the catalog,
  // applying the same 1-year indefinite exclusion rule so it matches the list.
  const catalogMatchCount = useMemo(() => {
    if (catalogCNs.size === 0 || shortages.length === 0) return 0;

    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    return shortages.filter(item => {
      const rawCN = item.cn || item.nregistro;
      const numericString = rawCN ? String(rawCN).replace(/\D/g, '') : '';
      const apiCN = numericString.length >= 6 ? numericString.substring(0, 6) : numericString;

      if (!catalogCNs.has(apiCN)) return false;

      // Ensure 1-year rule matches GUI list exactly
      const startMs = Number(item.fini);
      let hasIndefiniteEnd = false;
      if (!item.ffin) {
        hasIndefiniteEnd = true;
      } else {
        const endYear = new Date(item.ffin).getFullYear();
        if (endYear > 2040) hasIndefiniteEnd = true;
      }

      if (startMs && (now - startMs > oneYearMs) && hasIndefiniteEnd) {
        return false;
      }

      return true;
    }).length;
  }, [shortages, catalogCNs]);

  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #0d9488', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLogin={(email) => {
          setIsAuthenticated(true);
          setUserEmail(email || '');
          setActiveModule('menu');
        }}
      />
    );
  }

  // ── Menú principal (selección de módulo) ──
  if (activeModule === 'menu') {
    return (
      <MainMenuScreen
        onSelectModule={setActiveModule}
        onLogout={handleLogout}
        userEmail={userEmail}
      />
    );
  }

  // ── Módulo BlisterCheck ──
  if (activeModule === 'blistercheck') {
    return (
      <ErrorBoundary>
        <BlisterCheckApp onVolver={() => setActiveModule('menu')} />
      </ErrorBoundary>
    );
  }

  // ── Módulo NIOSH ──
  if (activeModule === 'niosh') {
    return (
      <ErrorBoundary>
        <NioshApp onVolver={() => setActiveModule('menu')} />
      </ErrorBoundary>
    );
  }

  // ── Módulo Pedidos Mínimos ──
  if (activeModule === 'pedidosminimos') {
    return (
      <ErrorBoundary>
        <PedidosMinimosApp onVolver={() => setActiveModule('menu')} />
      </ErrorBoundary>
    );
  }

  // ── Módulo Análisis Económico ──
  if (activeModule === 'analisiseconomico') {
    return (
      <ErrorBoundary>
        <AnalisisEconomicoApp onVolver={() => setActiveModule('menu')} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button
            onClick={() => setActiveModule('menu')}
            className="bc-back-btn"
            title="Volver al menú principal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem' }}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Volver al menú de inicio
          </button>

          <button
            onClick={handleLogout}
            className="logout-btn"
            title="Cerrar sesión"
          >
            Cerrar sesión
          </button>
        </div>

        <Header />

        <main className="main-content">
          <CatalogUpload onCatalogLoaded={handleCatalogLoaded} />

          <EmailConfig catalogCNs={catalogCNs} />

          {/* Standalone match counter — shown when catalog is loaded */}
          {catalogCNs.size > 0 && (
            <div className={`glass-panel ${shortages.length === 0 ? 'empty-warning' : ''}`} style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: catalogMatchCount > 0 ? 'var(--color-accent)' : 'var(--color-primary)',
              marginBottom: '2rem',
              borderLeft: `4px solid ${catalogMatchCount > 0 ? 'var(--color-accent)' : 'var(--color-primary)'}`,
              transition: 'all 0.3s ease'
            }}>
              <span>
                {catalogMatchCount > 0
                  ? `${catalogMatchCount} de tus ${catalogCNs.size} medicamentos están en desabastecimiento`
                  : `Ninguno de tus ${catalogCNs.size} medicamentos está en desabastecimiento (Si la lista general está vacía, recuerda ejecutar el Script de Sincronización Diario).`
                }
              </span>
            </div>
          )}

          <div className="controls-row">
            <Filters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              showCriticalOnly={showCriticalOnly}
              setShowCriticalOnly={setShowCriticalOnly}
            />

            {catalogCNs.size > 0 && (
              <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label className={`toggle-btn ${showCatalogOnly ? 'active' : ''}`} style={{ border: 'none', background: 'transparent', padding: 0 }}>
                  <input
                    type="checkbox"
                    checked={showCatalogOnly}
                    onChange={(e) => setShowCatalogOnly(e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span>Ver solo mis medicamentos afectados</span>
                </label>
                <button
                  onClick={handleClearCatalog}
                  style={{
                    background: 'transparent',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                  title="Borrar archivo guardado"
                >
                  Borrar Archivo
                </button>
              </div>
            )}


          </div >

          {error && (
            <div className="error-banner glass-panel">
              <span>{error}</span>
            </div>
          )}

          <ShortageList
            shortages={filteredShortages}
            loading={loading}
            progress={loadProgress}
            managedCNs={managedCNs}
            onToggleManaged={toggleManaged}
            notes={notes}
            onUpdateNote={updateNote}
          />
        </main >
      </div >
    </ErrorBoundary >
  );
}

export default App;
