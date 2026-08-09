const Papa = require('papaparse');
const fs = require('fs');

const csv = `"Competncia","Solicitante","Destinatrio","Total Estoque Bruto","Total Passivo Bruto","Total Fluxo Bruto","Total"
"11/2025","RGPS","RORAIMA",0.00,0.00,822.54,822.54
"Competncia","Solicitante","UF Solicitante","Destinatrio","UF Destinatrio","Tipo Requerimento","Tipo Deferimento","Protocolo","CPF Beneficirio","Nmero Benefcio","NIT","Matrcula","Pr-rata atual","Valor Estoque","Valor 13 Estoque","Valor Passivo","Valor 13 Passivo","Valor Fluxo Mensal","Valor 13 Fluxo Mensal"
"11/2025","RORAIMA","RR","RGPS"," ","Aposentadoria","Deferido Automaticamente","01000002209141681105122024","00220914168"," ",10042429827,"050001659",525.09,0.00,0.00,0.00,0.00,525.09,0.00`;

const parsed = Papa.parse(csv, { skipEmptyLines: true });
const data = parsed.data;

let summaryPagar = 0;
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row.length >= 7 && row[0] === 'Competência' && row[1] === 'Solicitante' && row[2] === 'Destinatário') {
    summaryPagar = 1;
  }
}
console.log("With accents:", summaryPagar);

let summaryPagar2 = 0;
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row.length >= 7 && row[1] === 'Solicitante' && row[6] === 'Total') {
    summaryPagar2 = parseFloat(data[i+1][6] || 0);
  }
}
console.log("Without accents:", summaryPagar2);

