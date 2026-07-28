// api/check-auth.js
export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // El middleware se ejecuta antes que este archivo.
    // Si la petición llega hasta aquí, significa que el middleware de Edge 
    // validó la cookie correctamente y dejó pasar la petición.
    return res.status(200).json({ authenticated: true });
}
