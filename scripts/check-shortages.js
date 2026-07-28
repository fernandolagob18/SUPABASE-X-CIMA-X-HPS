/**
 * CIMA Watch — Daily Shortage Check & Email Notification Script (V2 - Supabase Persisted)
 * 
 * Runs via GitHub Actions cron at 8:00 AM daily.
 * 1. Fetches current shortages from CIMA API
 * 2. Saves/Updates them to `desabastecimientos_activos` in Supabase
 * 3. Identifies changes based on `seguimiento_medicamentos` and previous data
 * 4. Sends email via Gmail SMTP
 */

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const { buildEmailHTML } = require('./email-template');

// --- Configuration from environment variables ---
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const CIMA_API_URL = 'https://cima.aemps.es/cima/rest/psuministro';
const PAGE_SIZE = 200;
const CONCURRENCY_LIMIT = 5;

// --- Helper: Fetch with retry ---
async function fetchWithRetry(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                if (attempt === retries) throw new Error(`HTTP error: ${res.status}`);
                console.warn(`Attempt ${attempt} failed with status ${res.status}. Retrying...`);
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
            return await res.json();
        } catch (err) {
            if (attempt === retries) throw err;
            console.warn(`Attempt ${attempt} failed: ${err.message}. Retrying...`);
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}

// --- Helper: Fetch all shortages from CIMA API ---
async function fetchAllShortages() {
    console.log('Fetching shortages from CIMA API...');
    const cacheBuster = `&t=${Date.now()}`;
    let allResults = [];

    const firstData = await fetchWithRetry(`${CIMA_API_URL}?pagina=1&tamanioPagina=${PAGE_SIZE}${cacheBuster}`);

    const totalItems = firstData.totalFilas || 0;
    allResults = firstData.resultados || [];

    if (totalItems === 0) return [];

    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    console.log(`Total: ${totalItems} items across ${totalPages} pages`);

    if (totalPages > 1) {
        const remainingPages = [];
        for (let i = 2; i <= totalPages; i++) remainingPages.push(i);

        for (let i = 0; i < remainingPages.length; i += CONCURRENCY_LIMIT) {
            const chunk = remainingPages.slice(i, i + CONCURRENCY_LIMIT);
            const results = await Promise.all(
                chunk.map(async (pageNum) => {
                    try {
                        const data = await fetchWithRetry(`${CIMA_API_URL}?pagina=${pageNum}&tamanioPagina=${PAGE_SIZE}${cacheBuster}`);
                        return data.resultados || [];
                    } catch (err) {
                        console.error(`Fatal error fetching page ${pageNum} after retries:`, err.message);
                        throw err; // Abort the whole sync process to avoid data corruption
                    }
                })
            );
            results.forEach(r => { allResults = [...allResults, ...r]; });
        }
    }

    console.log(`Fetched ${allResults.length} total shortages from CIMA.`);
    return allResults;
}

// --- Helper: Normalize CN ---
function normalizeCN(rawCN) {
    if (!rawCN) return '';
    const numeric = String(rawCN).replace(/\D/g, '');
    return numeric.length >= 6 ? numeric.substring(0, 6) : numeric;
}

// --- Helper: Criticidad ---
function isCritical(item) {
    if (item.activo !== 1) return false;
    const obs = item.observ ? item.observ.toLowerCase().replace(/\s+/g, ' ') : '';
    const alleviationTriggers = [
        'existe/n otro/s', 'existen otros', 'existe otro', 'tratamientos alternativos',
        'el médico', 'tratamientos comercializados', 'principio activo', 'principios activos',
        'misma vía de administración', 'de administracion', 'de administración'
    ];
    if (alleviationTriggers.some(t => obs.includes(t))) return false;
    const criticalTriggers = ['medicamento extranjero', 'distribución controlada', 'suministro controlado', 'comercialización excepcional'];
    if (criticalTriggers.some(t => obs.includes(t))) return true;
    return true;
}

async function main() {
    console.log('=== CIMA Watch Daily Check (V2) ===');
    console.log(`Date: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('Missing Supabase credentials');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // --- Helper to fetch all records from Supabase (bypassing 1000 limit) ---
    async function fetchAllRecords(table, selectCols = '*', queryBuilder = null) {
        let allData = [];
        let from = 0;
        const step = 1000;
        while (true) {
            let baseQuery = supabase.from(table).select(selectCols);
            if (queryBuilder) {
                baseQuery = queryBuilder(baseQuery);
            }
            const { data, error } = await baseQuery.range(from, from + step - 1);
            if (error) {
                console.error(`Error fetching ${table}:`, error);
                break;
            }
            if (!data || data.length === 0) break;
            allData = [...allData, ...data];
            if (data.length < step) break;
            from += step;
        }
        return allData;
    }

    // 1. Fetch Subscription Info (Emails)
    const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .limit(1)
        .single();

    if (subError || !subscription || !subscription.emails || subscription.emails.length === 0) {
        console.log('No valid subscription or emails configured. Skipping email send.');
        // We still proceed to sync DB
    }
    const emails = subscription?.emails || [];
    const hospitalName = subscription?.hospital_name || 'Hospital';

    // 2. Fetch Hospital Catalog
    const catalogData = await fetchAllRecords('catalogo_hospital', 'cn');
    const catalogSet = new Set(catalogData.map(c => c.cn));
    console.log(`Hospital Catalog loaded with ${catalogSet.size} items.`);

    if (catalogSet.size === 0) {
        console.log('Catalog is empty. Data synced but no emails need to be sent based on catalog.');
    }

    // 3. Fetch Previous DB State of Shortages before Update
    const previousActive = await fetchAllRecords('desabastecimientos_activos');

    const previousMap = new Map();
    if (previousActive) {
        previousActive.forEach(item => previousMap.set(item.cn, item));
    }

    // 4. Fetch Current Shortages from CIMA
    const allCimaRaw = await fetchAllShortages();
    const currentCimaMap = new Map();

    // UI applies a rule: ignore shortages > 1 year old if they have no definite end date
    const nowMs = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    allCimaRaw.forEach(item => {
        const startMs = item.fini ? Number(item.fini) : null;
        let hasIndefiniteEnd = false;

        if (!item.ffin) {
            hasIndefiniteEnd = true;
        } else {
            const endYear = new Date(item.ffin).getFullYear();
            if (endYear > 2040) hasIndefiniteEnd = true;
        }

        // Apply same filter as App.jsx
        if (startMs && (nowMs - startMs > oneYearMs) && hasIndefiniteEnd) {
            return; // Skip adding to current active map
        }

        const cn = normalizeCN(item.cn || item.nregistro);
        if (cn) currentCimaMap.set(cn, item);
    });

    // 5. Update `desabastecimientos_activos` in Supabase (Sync)
    // First, clear old ones that are truly resolved (no longer in CIMA at all)
    // To be safe, we delete ALL and re-insert or use UPSERT and delete missing.
    // For large datasets, deleting what is not in currentCimaMap is better.
    const cnKeysToKeep = Array.from(currentCimaMap.keys());

    // 5.1 Delete ones no longer in CIMA
    const cnsToDelete = Array.from(previousMap.keys()).filter(cn => !currentCimaMap.has(cn));

    if (cnsToDelete.length > 0) {
        // Delete in batches
        for (let i = 0; i < cnsToDelete.length; i += 1000) {
            const batch = cnsToDelete.slice(i, i + 1000);

            // Delete from active shortages
            await supabase.from('desabastecimientos_activos').delete().in('cn', batch);

            // AUTOMATIC CLEANUP: Also delete any tracking notes/managed status for these resolved shortages
            // This is safe because we use the SUPABASE_SERVICE_KEY which bypasses RLS
            await supabase.from('seguimiento_medicamentos').delete().in('cn', batch);
        }
    }

    // 5.2 Upsert current ones
    const upsertPayload = Array.from(currentCimaMap.values()).map(item => ({
        cn: normalizeCN(item.cn || item.nregistro),
        nombre: item.nombre || '',
        observaciones: item.observ || '',
        fecha_inicio: item.fini ? Number(item.fini) : null,
        fecha_fin: item.ffin ? Number(item.ffin) : null,
        criticidad: isCritical(item) ? 'critical' : 'normal',
        last_sync: new Date().toISOString()
    }));

    for (let i = 0; i < upsertPayload.length; i += 1000) {
        const { error: upsertError } = await supabase
            .from('desabastecimientos_activos')
            .upsert(upsertPayload.slice(i, i + 1000), { onConflict: 'cn' });
        if (upsertError) console.error("Error upserting chunk:", upsertError);
    }
    console.log("DB Sync complete.");

    // If no emails or catalog, stop here
    if (emails.length === 0 || catalogSet.size === 0) {
        console.log("Sync done. No emails to process.");
        process.exit(0);
    }

    // 6. Classification for Emailing (Intersection with Catalog)
    // We care about items that are in the catalog.
    // However, the catalog Excel might have multiple rows mapping to the SAME 6-digit CN.
    // The UI counts shortages by looking at `desabastecimientos` and checking `.has(apiCN)`.
    // To match the UI count perfectly (e.g. 40 items affected), we do the same:
    const newShortages = [];
    const continuingShortages = [];
    const resolvedShortages = [];

    // Fetch ALL Seguimiento state (small table — no .in() filter to avoid URL length limits)
    const seguimientoData = await fetchAllRecords('seguimiento_medicamentos');

    const seguimientoMap = new Map();
    if (seguimientoData) {
        seguimientoData.forEach(s => seguimientoMap.set(String(s.cn), s));
    }

    // Debug: count how many managed items we found
    const managedCount = Array.from(seguimientoMap.values()).filter(s => s.estado_gestion === true).length;
    console.log(`Seguimiento loaded: ${seguimientoData.length} total records, ${managedCount} marked as managed.`);

    // Process Active Shortages (New & Continuing) against the Catalog
    upsertPayload.forEach(item => {
        const cnStr = String(item.cn);
        if (!catalogSet.has(cnStr)) return; // Not in user's inventory

        const wasInDbPrev = previousMap.has(cnStr);
        const isManaged = seguimientoMap.has(cnStr) && seguimientoMap.get(cnStr).estado_gestion === true;

        if (!wasInDbPrev) {
            newShortages.push(item);
        } else {
            if (!isManaged) {
                continuingShortages.push(item);
            }
        }
    });

    // Process Resolved Shortages (In old DB, in Catalog, but NOT in current CIMA)
    previousMap.forEach((prevItem, cn) => {
        if (catalogSet.has(cn) && !currentCimaMap.has(cn)) {
            resolvedShortages.push(prevItem);
        }
    });

    console.log(`Email Prep: ${newShortages.length} New, ${continuingShortages.length} Cont (unmanaged), ${resolvedShortages.length} Resolved`);

    if (newShortages.length === 0 && continuingShortages.length === 0 && resolvedShortages.length === 0) {
        console.log("No relevant changes to notify. Skipping email.");
        process.exit(0);
    }

    // 7. Send Email
    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
        const today = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid'
        });

        const htmlContent = buildEmailHTML({
            hospitalName,
            date: today,
            newShortages,
            continuingShortages,
            resolvedShortages,
            v2: true // flag if template needs tweaks later
        });

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
        });

        let subject = `📊 CIMA Watch — Informe diario (${new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })})`;
        if (newShortages.length > 0) subject = `🚨 CIMA Watch — ${newShortages.length} nuevo(s) desabastecimiento(s)`;
        else if (resolvedShortages.length > 0) subject = `✅ CIMA Watch — Medicamento(s) restablecido(s)`;

        for (const recipient of emails) {
            try {
                await transporter.sendMail({
                    from: `"CIMA Watch" <${GMAIL_USER}>`,
                    to: recipient,
                    subject,
                    html: htmlContent
                });
                console.log(`✅ Email sent to ${recipient}`);
            } catch (err) {
                console.error(`❌ Failed to send to ${recipient}:`, err.message);
            }
        }
    } else {
        console.warn("Gmail missing. Skipped sending email logs.");
    }

    console.log('=== Done ===');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
