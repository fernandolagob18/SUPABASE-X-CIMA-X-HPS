async function debug() {
    const target = '762436';
    const res = await fetch(`https://cima.aemps.es/cima/rest/psuministro?cn=${target}`);
    if (res.ok) {
        const data = await res.json();
        if (data.resultados && data.resultados.length > 0) {
            console.log('FOUND DIRECTLY:', data.resultados[0].nombre);
        } else {
            console.log('API returned 200 OK but NO active shortage results for', target);
        }
    } else {
        console.log('API Error:', res.status);
    }
}
debug();
