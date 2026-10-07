import { useState, useEffect } from 'react';
import './index.css';
import './pedidos.css';
import './analisiseconomico.css';
import { supabase } from './lib/supabase';
import ErrorBoundary from './components/ErrorBoundary';
import LoginScreen from './components/LoginScreen';
import MainMenuScreen from './components/MainMenuScreen';
import NioshApp from './components/niosh/NioshApp';
import PedidosMinimosApp from './components/pedidosminimos/PedidosMinimosApp';
import AnalisisEconomicoApp from './components/analisiseconomico/AnalisisEconomicoApp';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeModule, setActiveModule] = useState('menu'); // 'menu' | 'niosh' | 'pedidosminimos' | 'analisiseconomico'
  const [userEmail, setUserEmail] = useState('');

  // Inicialización de sesión al cargar la página
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=2592000; SameSite=Lax; Secure`;

          const res = await fetch('/api/check-auth');
          if (res.ok) {
            setIsAuthenticated(true);
            setUserEmail(session.user?.email || '');
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();

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

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error', e);
    }
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setActiveModule('menu');
    setUserEmail('');
  };

  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', justifyContent: 'center', alignItems: 'center', background: 'var(--color-bg)' }}>
        <div className="spinner"></div>
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

  // ── Menú principal (pantalla por defecto) ──
  return (
    <MainMenuScreen
      onSelectModule={setActiveModule}
      onLogout={handleLogout}
      userEmail={userEmail}
    />
  );
}

export default App;
