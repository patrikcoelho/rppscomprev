const Papa = require('papaparse');
const fs = require('fs');

const csv = `"Competência","Solicitante","Destinatário","Total Estoque Bruto","Total Passivo Bruto","Total Fluxo Bruto","Total"
"11/2025","RGPS","RORAIMA",0.00,0.00,822.54,822.54
"Competência","Solicitante","UF Solicitante","Destinatário","UF Destinatário","Tipo Requerimento","Tipo Deferimento","Protocolo","CPF Beneficiário","Número Benefício","NIT","Matrícula","Pró-rata atual","Valor Estoque","Valor 13 Estoque","Valor Passivo","Valor 13 Passivo","Valor Fluxo Mensal","Valor 13 Fluxo Mensal"
"11/2025","RORAIMA","RR","RGPS"," ","Aposentadoria","Deferido Automaticamente","01000002209141681105122024","00220914168"," ",10042429827,"050001659",525.09,0.00,0.00,0.00,0.00,525.09,0.00
`;

const glosasCsv = `"Competência","Protocolo","Solicitante","Beneficiário","CPF","NIT","Matrícula Beneficiário","NB","Nome do Beneficiário","Data Inicio Glosa Estoque","Data Fim Glosa Estoque","Data Inicio Glosa Passivo","Data Fim Glosa Passivo","Data Inicio Glosa Fluxo","Data Fim Glosa Fluxo","Valor Glosa Estoque","Valor Glosa Passivo","Valor Glosa Fluxo","Valor Glosa","Valor Pro Rata Mensal","Motivo Glosa","Tipo Requerimento","Usuário"
"11/2025","01000689122348201118112021","RR - RORAIMA","BR - RGPS","68912234820",10994871438,"040000198"," ","LUIZ CARLOS NISTAL",0,0,0,0,021125,301125,0.00,0.00,134.90,134.90,809.40,"Pagamento após o óbito","Aposentadoria"," "
`;

function parseCustom(csvString) {
  const parsed = Papa.parse(csvString, { skipEmptyLines: true });
  let headerIndex = -1;
  let headers = [];
  
  // Find header row
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('cpf'))) {
      headerIndex = i;
      headers = row;
      break;
    }
  }

  if (headerIndex === -1) {
    console.log("No header found with CPF");
    return [];
  }

  const result = [];
  for (let i = headerIndex + 1; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const obj = {};
    headers.forEach((h, index) => {
      obj[h] = row[index];
    });
    result.push(obj);
  }
  
  return result;
}

console.log(parseCustom(csv));
console.log(parseCustom(glosasCsv));

