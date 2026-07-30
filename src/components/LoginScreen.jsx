import { useState } from 'react';
import { supabase } from '../lib/supabase';

function LoginScreen({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [shaking, setShaking] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setError(false);
        setErrorMessage('');

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                setError(true);
                setErrorMessage(authError.message === 'Invalid login credentials' 
                    ? 'Credenciales incorrectas' 
                    : authError.message);
                setShaking(true);
                setTimeout(() => setShaking(false), 500);
            } else if (data.session) {
                // Para que el Middleware de Vercel pueda validar la sesión, guardamos el JWT en una cookie
                const token = data.session.access_token;
                // Max-Age = 30 días
                // SameSite=Lax es compatible con Edge en primera carga; Strict puede bloquearse en Edge
                // con historial limpio por cómo gestiona el contexto de seguridad en primera navegación.
                document.cookie = `sb-access-token=${token}; path=/; max-age=2592000; SameSite=Lax; Secure`;

                // Pequeño delay para garantizar que Edge (y otros navegadores estrictos)
                // hayan registrado la cookie antes de disparar la recarga de datos.
                // Sin este delay, en Edge con historial limpio, loadData() se ejecuta
                // antes de que la cookie esté disponible para las peticiones API → 401.
                await new Promise(resolve => setTimeout(resolve, 150));

                onLogin(data.session.user?.email || '');
            }
        } catch (err) {
            setError(true);
            setErrorMessage('Error al intentar acceder');
            setShaking(true);
            setTimeout(() => setShaking(false), 500);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-overlay">
            <form
                className={`login-panel glass-panel ${shaking ? 'login-shake' : ''}`}
                onSubmit={handleSubmit}
            >
                <div className="login-icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </div>

                <h1 className="login-title">HPS Suite</h1>
                <p className="login-subtitle">Introduce tus credenciales</p>

                <div className="login-field">
                    <input
                        id="login-email"
                        type="email"
                        className={`login-input ${error ? 'login-input-error' : ''}`}
                        placeholder="Correo electrónico"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setError(false);
                        }}
                        disabled={loading}
                        autoFocus
                        required
                    />
                </div>

                <div className="login-field">
                    <input
                        id="login-password"
                        type="password"
                        className={`login-input ${error ? 'login-input-error' : ''}`}
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setError(false);
                        }}
                        disabled={loading}
                        required
                    />
                    {error && (
                        <span className="login-error-msg">{errorMessage || 'Error de acceso'}</span>
                    )}
                </div>

                <button
                    type="submit"
                    className="login-btn"
                    id="login-submit"
                    disabled={loading}
                >
                    {loading ? 'Verificando...' : 'Acceder'}
                </button>
            </form>
        </div>
    );
}

export default LoginScreen;
