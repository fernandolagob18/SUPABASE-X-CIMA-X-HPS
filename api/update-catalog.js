import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase credentials not configured' });
    }

    const { catalogCNs, borrarTodo } = req.body;

    if (!Array.isArray(catalogCNs) || (catalogCNs.length === 0 && !borrarTodo)) {
        return res.status(400).json({ error: 'Catálogo vacío o inválido.' });
    }

    // Using service_role key to bypass RLS and perform INSERT/DELETE
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        // Atomic Operation using a predefined Supabase flow or transaction approximation.
        // We will delete all current entries and insert new ones.
        // As Supabase default JS client doesn't support traditional transactions across multiple queries natively without RPC,
        // we will process it by first inserting, and if successful, we delete the old ones.
        // Alternatively (Standard Approach): 
        // 1. Delete all.
        // 2. Insert new ones.
        // If 2 fails, we theoretically lost step 1. But since this is a full replacement, 
        // doing Delete then Insert is the most direct way via REST API.

        // Delete existing catalog
        const { error: deleteError } = await supabase
            .from('catalogo_hospital')
            .delete()
            .neq('cn', 'impossible_value'); // Delete all rows approach

        if (deleteError) {
            console.error("Error deleting old catalog:", deleteError);
            return res.status(500).json({ error: 'Error deleting previous catalog' });
        }

        // Prepare new data
        const newRows = catalogCNs.map(cn => ({ cn: String(cn) }));

        // Insert in batches of 1000 to prevent payload size limits
        const BATCH_SIZE = 1000;
        if (newRows.length > 0) {
            for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
                const batch = newRows.slice(i, i + BATCH_SIZE);
                const { error: insertError } = await supabase
                    .from('catalogo_hospital')
                    .insert(batch);

                if (insertError) {
                    console.error("Error inserting matching batch:", insertError);
                    return res.status(500).json({ error: 'Error inserting new catalog items' });
                }
            }
        }

        return res.status(200).json({ message: 'Catálogo actualizado correctamente', total: catalogCNs.length });

    } catch (err) {
        console.error('Server error during catalog update:', err);
        return res.status(500).json({ error: 'Internal server error while updating catalog' });
    }
}
