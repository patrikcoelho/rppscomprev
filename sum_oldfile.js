const fs = require('fs');
const Papa = require('papaparse');
const file = fs.readFileSync('/Users/patrik/.gemini/antigravity/brain/b2eaf4e4-c7d6-42e6-bac1-ea0a71ce6978/.user_uploaded/media_1786232785325.csv', 'utf8');

Papa.parse(file, {
  header: false,
  skipEmptyLines: true,
  complete: function(results) {
    const data = results.data;
    let headerIndex = -1;
    let headers = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('cpf'))) {
        headerIndex = i;
        headers = row;
        break;
      }
    }
    
    const parsedObjects = [];
    for (let i = headerIndex + 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      headers.forEach((h, index) => {
        if (h) {
          obj[h] = row[index];
        }
      });
      parsedObjects.push(obj);
    }
    
    const rows = parsedObjects.map((row) => {
      const keys = Object.keys(row);
      const getVal = (search) => {
        const normalizedSearch = search.toLowerCase().replace(/[^a-z0-9]/g, '');
        let key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch);
        if (!key) key = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedSearch));
        return key ? row[key] : undefined;
      };

      const parseVal = (v) => {
        const s = String(v || '0').trim();
        if (!s) return 0;
        const num = parseFloat(s.replace(',', '.'));
        return isNaN(num) ? 0 : num;
      };

      const valorTotalCol = parseVal(getVal('valortotal'));
      const valorFluxo = parseVal(getVal('valorfluxomensal')) || parseVal(getVal('valorfluxocalculado'));
      const valor13Fluxo = parseVal(getVal('valor13fluxomensal')) || parseVal(getVal('valor13fluxocalculado'));
      const valorProRata = parseVal(getVal('valorproratabase'));

      return {
        cpf: getVal('cpf'),
        valorTotal: valorTotalCol,
        valorFluxoTotal: valorFluxo + valor13Fluxo + valorProRata,
      };
    }).filter((r) => r.cpf && (r.valorTotal > 0 || r.valorFluxoTotal > 0));
    
    console.log("Sum Total (Valor Total column): ", rows.reduce((acc, r) => acc + r.valorTotal, 0));
    console.log("Sum Fluxo (Fluxo Calculado + 13 Fluxo + Pro Rata): ", rows.reduce((acc, r) => acc + r.valorFluxoTotal, 0));
  }
});
