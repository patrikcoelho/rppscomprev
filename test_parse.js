const keys = ["Competência","Solicitante","UF Solicitante","Destinatário","UF Destinatário","Tipo Requerimento","Tipo Deferimento","Protocolo","CPF Beneficiário","Número Benefício","NIT","Matrícula","Pró-rata atual","Valor Estoque","Valor 13 Estoque","Valor Passivo","Valor 13 Passivo","Valor Fluxo Mensal","Valor 13 Fluxo Mensal"];

const row = {};
keys.forEach(k => row[k] = "100.00");
row["CPF Beneficiário"] = "12345678901";

const getVal = (search) => {
  const normalizedSearch = search.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = keys.find(k => {
    const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedKey.includes(normalizedSearch);
  });
  console.log('Search:', search, 'Found key:', key, 'Value:', key ? row[key] : undefined);
  return key ? row[key] : undefined;
};

const cpfRaw = getVal('cpfbeneficirio') || getVal('cpfbeneficiario') || getVal('cpf') || '';
const valorFluxo = parseFloat((getVal('valorfluxomensal') || '0').toString().replace(',', '.'));
const prorata = parseFloat((getVal('prrata') || getVal('prorata') || '0').toString().replace(',', '.'));

console.log({ cpfRaw, valorFluxo, prorata });
