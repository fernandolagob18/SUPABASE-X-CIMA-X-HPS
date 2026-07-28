const fs = require('fs');
async function debug() {
    let allResults = [];
    const PAGE_SIZE = 500;
    const firstRes = await fetch(`https://cima.aemps.es/cima/rest/psuministro?pagina=1&tamanioPagina=${PAGE_SIZE}`);
    const firstData = await firstRes.json();
    const totalItems = firstData.totalFilas || 0;
    allResults = firstData.resultados || [];
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);

    if (totalPages > 1) {
        const promises = [];
        for (let i = 2; i <= totalPages; i++) {
            promises.push(fetch(`https://cima.aemps.es/cima/rest/psuministro?pagina=${i}&tamanioPagina=${PAGE_SIZE}`).then(r => r.json()));
        }
        const pagesData = await Promise.all(promises);
        pagesData.forEach(data => allResults = allResults.concat(data.resultados || []));
    }

    const target = '762436';
    const item = allResults.find(r => {
        const cnRaw = String(r.cn || '').replace(/\D/g, '');
        const nregRaw = String(r.nregistro || '').replace(/\D/g, '');
        return cnRaw.startsWith(target) || nregRaw.startsWith(target);
    });

    if (item) {
        console.log(`\n=== FOUND [${target}] ===`);
        console.log(`Name: ${item.nombre}`);
        console.log(`  fini: ${item.fini} (${new Date(item.fini).toISOString()})`);
        console.log(`  ffin: ${item.ffin} (${item.ffin ? new Date(item.ffin).toISOString() : 'none'})`);

        const nowMs = Date.now();
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        const startMs = item.fini ? Number(item.fini) : null;

        let hasIndefiniteEnd = false;
        if (!item.ffin) {
            hasIndefiniteEnd = true;
        } else {
            const endYear = new Date(item.ffin).getFullYear();
            if (endYear > 2040) hasIndefiniteEnd = true;
        }

        const isFiltered = (startMs && (nowMs - startMs > oneYearMs) && hasIndefiniteEnd);
        console.log(`  Is >1 year old? : ${(nowMs - startMs) > oneYearMs}`);
        console.log(`  Has indefinite >2040 end date? : ${hasIndefiniteEnd}`);
        console.log(`  --> FILTERED OUT BY 1-YEAR RULE? : ${isFiltered}`);
    } else {
        console.log(`\n=== [${target}] NOT FOUND ===`);
    }
}
debug();
