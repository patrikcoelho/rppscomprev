const Papa = require('papaparse');
const fs = require('fs');

const csv = `"Competência","Solicitante","Destinatário","Total Estoque Bruto","Total Passivo Bruto","Total Fluxo Bruto","Total"
"11/2025","RGPS","RORAIMA",0.00,0.00,822.54,822.54
"Competência","Solicitante","UF Solicitante","Destinatário","UF Destinatário","Tipo Requerimento","Tipo Deferimento","Protocolo","CPF Beneficiário","Número Benefício","NIT","Matrícula","Pró-rata atual","Valor Estoque","Valor 13 Estoque","Valor Passivo","Valor 13 Passivo","Valor Fluxo Mensal","Valor 13 Fluxo Mensal"
"11/2025","RORAIMA","RR","RGPS"," ","Aposentadoria","Deferido Automaticamente","01000002209141681105122024","00220914168"," ",10042429827,"050001659",525.09,0.00,0.00,0.00,0.00,525.09,0.00
`;

const parsed = Papa.parse(csv, { skipEmptyLines: true });
const data = parsed.data;

let globalPagar = 0;
let globalReceber = 0;

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row.length === 7 && row[0] === 'Competência' && row[1] === 'Solicitante' && row[2] === 'Destinatário') {
    // Found summary header
    const nextRow = data[i+1];
    if (nextRow && nextRow.length === 7) {
      const solicitante = nextRow[1];
      const destinatario = nextRow[2];
      const total = parseFloat(nextRow[6]);
      if (solicitante === 'RGPS' && total > 0) {
        globalPagar += total;
      } else if (solicitante !== 'RGPS' && total > 0) {
        globalReceber += total;
      }
    }
  }
}

console.log("Global Pagar:", globalPagar);
console.log("Global Receber:", globalReceber);
