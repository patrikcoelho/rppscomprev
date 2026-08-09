const fs = require('fs');
const Papa = require('papaparse');
const file = fs.readFileSync('/Users/patrik/.gemini/antigravity/brain/b2eaf4e4-c7d6-42e6-bac1-ea0a71ce6978/.user_uploaded/media_1786232785325.csv', 'utf8');

Papa.parse(file, {
  header: true,
  skipEmptyLines: true,
  complete: function(results) {
    let sumTotal = 0;
    let sumFluxo = 0;
    results.data.forEach(row => {
      let valTotal = row['Valor Total'];
      let valFluxo = row['Valor Fluxo Calculado'];
      let val13Fluxo = row['Valor 13 Fluxo Calculado'];
      let valProRata = row['Valor Pro Rata Base'];
      
      const parse = (v) => {
        if (!v) return 0;
        const n = parseFloat(v.replace(',', '.'));
        return isNaN(n) ? 0 : n;
      }
      
      sumTotal += parse(valTotal);
      sumFluxo += parse(valFluxo) + parse(val13Fluxo) + parse(valProRata);
    });
    console.log("Sum Total:", sumTotal);
    console.log("Sum Fluxo:", sumFluxo);
  }
});
