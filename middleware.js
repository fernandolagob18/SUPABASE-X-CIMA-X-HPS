import { jwtVerify, createRemoteJWKSet } from 'jose';

export const config = {
    matcher: '/api/:path*',
};

// ── JWKS (JSON Web Key Set) ────────────────────────────────────────────────
// Supabase expone las claves públicas en un endpoint estándar JWKS.
// jose cachea automáticamente las claves para no hacer una petición de red
// en cada request. Solo se recarga si las claves rotan (key rotation).
//
// Para proyectos ECC (P-256) → algoritmo ES256 (ECDSA, firma asimétrica).
// La clave privada NUNCA sale de Supabase; aquí solo usamos la pública.
let jwks = null;

function getJWKS() {
    if (!jwks) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
            throw new Error('VITE_SUPABASE_URL no está configurada en las variables de entorno.');
        }
        // Endpoint estándar JWKS de Supabase Auth
        jwks = createRemoteJWKSet(
            new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
        );
    }
    return jwks;
}

// ── Middleware principal ───────────────────────────────────────────────────
export default async function middleware(request) {
    const url = new URL(request.url);

    // Rutas públicas que no requieren autenticación
    const publicPaths = ['/api/psuministro', '/api/logout'];
    if (publicPaths.some(path => url.pathname.startsWith(path))) {
        return;
    }

    // ── 1. Extraer el token de la cookie ──────────────────────────────────
    const cookieHeader = request.headers.get('cookie') || '';

    let authToken = null;
    try {
        for (const part of cookieHeader.split('; ')) {
            const eqIdx = part.indexOf('=');
            if (eqIdx === -1) continue;
            const name = part.slice(0, eqIdx).trim();
            if (name === 'sb-access-token') {
                authToken = part.slice(eqIdx + 1);
                break;
            }
        }
    } catch (_) {
        authToken = null;
    }

    if (!authToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized: No session found' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // ── 2. Verificar la firma criptográfica del JWT con clave pública ─────
    try {
        const jwksSet = getJWKS();

        // jwtVerify verifica:
        //   ✅ Firma ECDSA P-256 (ES256) con la clave pública de Supabase
        //   ✅ Que el token no ha expirado (claim 'exp')
        //   ✅ Formato JWT correcto (header.payload.signature en base64url)
        await jwtVerify(authToken, jwksSet, {
            algorithms: ['ES256'],
        });

        // Token válido → dejar pasar la petición
        return;

    } catch (err) {
        // Diferenciamos el motivo de rechazo para logging interno
        let reason = 'Invalid token';
        if (err?.code === 'ERR_JWT_EXPIRED') {
            reason = 'Token expired';
        } else if (err?.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
            reason = 'Signature verification failed';
        } else if (err?.message?.includes('VITE_SUPABASE_URL')) {
            // Error de configuración del servidor
            console.error('[middleware] Error de configuración:', err.message);
            return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: `Unauthorized: ${reason}` }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
