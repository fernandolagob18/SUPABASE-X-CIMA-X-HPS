// api/logout.js
export default function handler(req, res) {
    // Borramos la cookie de Supabase poniendo una fecha del pasado
    const cookieStr = `sb-access-token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure`;

    res.setHeader('Set-Cookie', cookieStr);
    return res.status(200).json({ success: true });
}
