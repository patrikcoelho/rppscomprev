import { Server } from './store';

const CONFRONTO_SHEET_NAME = 'Confronto';

export function parseSheetDate(value: any): string {
  if (!value) return '';
  let numVal = Number(value);
  if (!isNaN(numVal) && String(value).trim() !== '') {
    const date = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    // Se tiver parte fracionária, é data e hora
    if (numVal % 1 !== 0) {
      const d = date.toISOString().split('T')[0].split('-').reverse().join('/');
      const t = date.toISOString().split('T')[1].substring(0, 5); // HH:MM
      return `${d} ${t}`;
    }
    return date.toISOString().split('T')[0].split('-').reverse().join('/');
  }
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return value.split('-').reverse().join('/');
    }
  }
  return String(value);
}

export function parseCompetencia(value: any): string {
  const str = parseSheetDate(value);
  // Se estiver no formato DD/MM/YYYY, remove o DD/ para ficar só MM/YYYY (Competência)
  if (str.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return str.substring(3);
  }
  return str;
}

export async function updateServerInSheet(token: string, spreadsheetId: string, rowIndex: number, server: Server) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Servidores!A${rowIndex}:E${rowIndex}?valueInputOption=USER_ENTERED`;
  const row = [server.name, server.cpf, server.fund, server.entryDate || '', server.origin];
  
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [row]
    })
  });
  
  if (!res.ok) {
    throw new Error('Falha ao atualizar servidor na planilha.');
  }
}

export async function appendServerToSheet(token: string, spreadsheetId: string, server: Server) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Servidores!A:E:append?valueInputOption=USER_ENTERED`;
  const row = [server.name, server.cpf, server.fund, server.entryDate || '', server.origin];
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [row]
    })
  });
  
  if (!res.ok) {
    throw new Error('Falha ao adicionar servidor na planilha.');
  }
}

export async function batchAppendServersToSheet(token: string, spreadsheetId: string, servers: Server[]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Servidores!A:E:append?valueInputOption=USER_ENTERED`;
  const values = servers.map(server => [
    server.name, 
    server.cpf, 
    server.fund, 
    server.entryDate || '', 
    server.origin
  ]);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values })
  });
  
  if (!res.ok) {
    throw new Error('Falha ao adicionar lote de servidores na planilha.');
  }
}


export async function appendPaymentToSheet(token: string, spreadsheetId: string, data: any) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pagamentos!A:E:append?valueInputOption=USER_ENTERED`;
  // data: [Competência, Nome, CPF, Fundo, Valor]
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [data]
    })
  });
  
  if (!res.ok) {
    throw new Error('Falha ao adicionar pagamento na planilha.');
  }
}

export async function batchAppendPaymentsToSheet(token: string, spreadsheetId: string, rows: any[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pagamentos!A:S:append?valueInputOption=USER_ENTERED`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: rows
    })
  });
  
  if (!res.ok) {
    throw new Error('Falha ao adicionar lote de pagamentos na planilha.');
  }
}

async function ensureSheetExists(token: string, spreadsheetId: string, sheetName: string) {
  const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const addSheetBody = {
    requests: [{ addSheet: { properties: { title: sheetName } } }]
  };

  const res = await fetch(batchUpdateUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(addSheetBody)
  });

  if (res.ok) {
    return true;
  }

  const errorText = await res.text();
  if (res.status === 400 && errorText.toLowerCase().includes('already exists')) {
    return true;
  }

  return false;
}

export interface ConfrontoSheetRow {
  cpf: string;
  nome: string;
  dataInicioBeneficio?: string;
  origem: string;
  statusConfronto: string;
  statusListaComprev: string;
  updatedAt?: string;
}

export async function writeConfrontoResultsToSheet(
  token: string,
  spreadsheetId: string,
  rows: ConfrontoSheetRow[]
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${CONFRONTO_SHEET_NAME}!A:G?valueInputOption=USER_ENTERED`;
  const values = [
    ['CPF', 'Nome', 'Data Início Benefício', 'Origem', 'Status Confronto', 'Status Lista Comprev', 'Atualizado Em'],
    ...rows.map(row => [
      row.cpf,
      row.nome,
      row.dataInicioBeneficio || '',
      row.origem,
      row.statusConfronto,
      row.statusListaComprev,
      row.updatedAt || new Date().toISOString()
    ])
  ];

  const write = async () => fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values })
  });

  let res = await write();
  if (res.ok) return;

  const errorText = await res.text();
  if (res.status === 400 || errorText.toLowerCase().includes('unable to parse range')) {
    const created = await ensureSheetExists(token, spreadsheetId, CONFRONTO_SHEET_NAME);
    if (created) {
      res = await write();
    }
  }

  if (!res.ok) {
    throw new Error('Falha ao atualizar a aba de confronto.');
  }
}

export async function fetchServersFromSheet(token: string, spreadsheetId: string): Promise<Server[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Servidores!A:E?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('TOKEN_EXPIRED');
    }
    return []; // Sheet might be empty or not found
  }
  
  const data = await res.json();
  const rows = data.values || [];
  
  return rows.map((row: any, index: number) => ({
    id: `sheet-${index}`,
    name: row[0] || '',
    cpf: String(row[1] || '').padStart(11, '0'),
    fund: row[2] || 'NAO_DEFINIDO',
    entryDate: parseSheetDate(row[3]),
    origin: row[4] || 'RGPS',
    status: 'APPROVED'
  }));
}

export async function fetchSheetData(token: string, spreadsheetId: string, sheetName: string): Promise<any[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!res.ok) {
    console.error(`Falha ao ler aba ${sheetName}`);
    return [];
  }
  
  const data = await res.json();
  const rows = data.values || [];
  
  if (rows.length === 0) return [];
  
  const headers: string[] = rows[0];
  const result = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj: any = { _rowIndex: i + 1 }; // useful if we ever want to update the row
    headers.forEach((header, index) => {
      // clean header to make it easier to access (trim spaces)
      const cleanHeader = (header || '').trim();
      obj[cleanHeader] = row[index] || '';
    });
    result.push(obj);
  }
  
  return result;
}

export interface ImportSummary {
  id: string;
  importDate: string;
  competencia: string;
  expectedTotal: number;
  receivedTotal: number;
  totalFF: number;
  totalFP: number;
}

export async function fetchImportsFromSheet(token: string, spreadsheetId: string): Promise<ImportSummary[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pagamentos!A:S?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('TOKEN_EXPIRED');
    return [];
  }
  
  const data = await res.json();
  const rows = data.values || [];
  
  // Skip header row if it exists (check if first row has 'ID' or 'Competência' etc)
  const startIndex = (rows.length > 0 && String(rows[0][0]).toLowerCase().includes('id')) ? 1 : 0;
  
  const importsMap = new Map<string, ImportSummary>();
  
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const importId = row[0];
    if (!importId) continue;
    
    if (!importsMap.has(importId)) {
      importsMap.set(importId, {
        id: importId,
        importDate: parseSheetDate(row[1]),
        competencia: parseCompetencia(row[2]),
        expectedTotal: parseNumber(row[4]),
        receivedTotal: parseNumber(row[5]),
        totalFF: 0,
        totalFP: 0
      });
    }

    const summary = importsMap.get(importId)!;
    const fund = row[11];
    const value = parseNumber(row[12]);

    if (fund === 'FUNDO_FINANCEIRO' || fund === 'FF') {
      summary.totalFF += value;
    } else if (fund === 'FUNDO_PREVIDENCIARIO' || fund === 'FP') {
      summary.totalFP += value;
    }
  }
  
  return Array.from(importsMap.values()).sort((a, b) => b.importDate.localeCompare(a.importDate));
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export async function fetchImportDetailsFromSheet(token: string, spreadsheetId: string, importId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pagamentos!A:S?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('TOKEN_EXPIRED');
    return null;
  }
  
  const data = await res.json();
  const rows = data.values || [];
  
  const details = {
    id: importId,
    importDate: '',
    competencia: '',
    paymentDate: '',
    expectedTotal: 0,
    receivedTotal: 0,
    difference: 0,
    servers: [] as any[],
    receivedByInstitution: {} as Record<string, number>
  };
  
  let found = false;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === importId) {
      if (!found) {
        found = true;
        details.importDate = parseSheetDate(row[1]);
        details.competencia = parseCompetencia(row[2]);
        details.paymentDate = parseSheetDate(row[3]);
        details.expectedTotal = parseNumber(row[4]);
        details.receivedTotal = parseNumber(row[5]);
        details.difference = parseNumber(row[6]);
      }
      
      const destinatario = row[7] || 'NAO_INFORMADO';

      if (typeof row[18] !== 'undefined' && !(destinatario in details.receivedByInstitution)) {
        details.receivedByInstitution[destinatario] = parseNumber(row[18]);
      }
      
      details.servers.push({
        destinatario: destinatario,
        cpf: String(row[8] || '').replace(/\D/g, '').padStart(11, '0'),
        name: row[9] || '',
        origin: row[10] || 'RGPS',
        fund: row[11] === 'FUNDO_FINANCEIRO' || row[11] === 'FF' ? 'FUNDO_FINANCEIRO' : row[11] === 'FUNDO_PREVIDENCIARIO' || row[11] === 'FP' ? 'FUNDO_PREVIDENCIARIO' : 'NAO_DEFINIDO',
        value: parseNumber(row[12]),
        receber: parseNumber(row[13]),
        pagar: parseNumber(row[14]),
        glosa: parseNumber(row[15]),
        observacao: row[16] || '',
        juros: parseNumber(row[17]),
        paymentDate: parseSheetDate(row[3])
      });
    }
  }
  
  return found ? details : null;
}

export async function createAcessosTab(token: string, spreadsheetId: string): Promise<boolean> {
  const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const addSheetBody = {
    requests: [{ addSheet: { properties: { title: 'Acessos' } } }]
  };
  
  try {
    const res1 = await fetch(batchUpdateUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(addSheetBody)
    });
    
    if (!res1.ok) {
      console.error('Failed to create Acessos tab', await res1.text());
      return false;
    }
    
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Acessos!A1:A2?valueInputOption=USER_ENTERED`;
    const updateBody = {
      values: [
        ['patrik.oliveira@iper.rr.gov.br'],
        ['petrycmusic@gmail.com']
      ]
    };
    
    const res2 = await fetch(updateUrl, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody)
    });
    
    return res2.ok;
  } catch (err) {
    console.error('Error creating Acessos tab:', err);
    return false;
  }
}

export async function verifyUserAccess(token: string, spreadsheetId: string, email: string): Promise<boolean> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Acessos!A:A`;
  try {
    let res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      if (res.status === 401) throw new Error('TOKEN_EXPIRED');
      
      const errorText = await res.text();
      if (res.status === 400 && errorText.includes('Unable to parse range')) {
        console.log('Aba Acessos não encontrada. Criando automaticamente...');
        const created = await createAcessosTab(token, spreadsheetId);
        if (created) {
          res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) return false;
        } else {
          return false;
        }
      } else {
        console.error('Acesso negado à planilha ou aba Acessos', errorText);
        return false;
      }
    }
    
    const data = await res.json();
    const rows = data.values || [];
    const allowedEmails = rows.map((r: any[]) => r[0]?.toString().toLowerCase().trim()).filter(Boolean);
    
    return allowedEmails.includes(email.toLowerCase().trim());
  } catch (err: any) {
    if (err.message === 'TOKEN_EXPIRED') throw err;
    console.error('Error verifying user access:', err);
    return false;
  }
}

export interface AjusteContaRow {
  id: string; // ex: 07/2026-RGPS
  competencia: string;
  entidade: string;
  cnpj: string;
  tipo: 'RECEBER' | 'PAGAR';
  valorEsperado: number;
  valorRealizado: number;
  status: 'Pendente' | 'Concluído';
  updatedAt?: string;
}

const AJUSTE_SHEET_NAME = 'Ajuste_Contas';

export async function fetchAjustesFromSheet(token: string, spreadsheetId: string): Promise<AjusteContaRow[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${AJUSTE_SHEET_NAME}!A:I?valueRenderOption=UNFORMATTED_VALUE`;
  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('TOKEN_EXPIRED');
      return [];
    }
    
    const data = await res.json();
    const rows = data.values || [];
    if (rows.length <= 1) return [];
    
    return rows.slice(1).map((row: any[]) => ({
      id: row[0] || '',
      competencia: parseCompetencia(row[1] || ''),
      entidade: row[2] || '',
      cnpj: row[3] || '',
      tipo: row[4] as 'RECEBER' | 'PAGAR',
      valorEsperado: parseNumber(row[5]),
      valorRealizado: parseNumber(row[6]),
      status: row[7] as 'Pendente' | 'Concluído',
      updatedAt: row[8] || ''
    }));
  } catch (err: any) {
    if (err.message === 'TOKEN_EXPIRED') throw err;
    console.error('Error fetching Ajustes:', err);
    return [];
  }
}

export async function writeAjustesToSheet(
  token: string,
  spreadsheetId: string,
  rows: AjusteContaRow[]
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${AJUSTE_SHEET_NAME}!A:I?valueInputOption=USER_ENTERED`;
  const values = [
    ['ID', 'Competência', 'Entidade', 'CNPJ', 'Tipo', 'Valor Esperado', 'Valor Realizado', 'Status', 'Atualizado Em'],
    ...rows.map(row => [
      row.id,
      row.competencia,
      row.entidade,
      row.cnpj,
      row.tipo,
      row.valorEsperado,
      row.valorRealizado,
      row.status,
      row.updatedAt || new Date().toISOString()
    ])
  ];

  const write = async () => fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values })
  });

  let res = await write();
  if (res.ok) return;

  let errorText = await res.text();
  
  if (res.status === 401 || res.status === 403) {
    throw new Error('TOKEN_EXPIRED');
  }

  if (res.status === 400 || errorText.toLowerCase().includes('unable to parse range')) {
    const created = await ensureSheetExists(token, spreadsheetId, AJUSTE_SHEET_NAME);
    if (created) {
      res = await write();
      if (res.ok) return;
      errorText = await res.text();
    } else {
      throw new Error(`Falha ao criar a aba Ajuste_Contas. Verifique se você tem permissão de Editor na planilha.`);
    }
  }

  throw new Error(`Falha ao atualizar a aba de Ajuste_Contas. Detalhes: ${errorText}`);
}
