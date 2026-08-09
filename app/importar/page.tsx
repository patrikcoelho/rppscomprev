'use client';

import { useState, useRef } from 'react';
import { useStore, Fund, Server, ReportServer } from '@/lib/store';
import { UploadCloud, CheckCircle, AlertTriangle, FileText, ArrowRight, Plus } from 'lucide-react';
import Papa from 'papaparse';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { fetchServersFromSheet, batchAppendServersToSheet, batchAppendPaymentsToSheet } from '@/lib/sheets';
import { v4 as uuidv4 } from 'uuid';

interface ParsedRow {
  cpf: string;
  nome: string;
  origem: string;
  valor: number;
  competencia: string;
  type: 'receber' | 'pagar' | 'glosa';
  destinatario: string;
  observacao?: string;
}

const FileBox = ({ 
  title, 
  desc, 
  file, 
  setFile, 
  inputRef, 
  required = false 
}: { 
  title: string; 
  desc: string; 
  file: File | null; 
  setFile: (f: File | null) => void; 
  inputRef: React.RefObject<HTMLInputElement | null>;
  required?: boolean;
}) => (
  <div 
    className={clsx(
      "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative",
      file ? "border-emerald-400 bg-emerald-50/50" : "border-slate-300 bg-white hover:bg-slate-50 hover:border-blue-400"
    )}
    onClick={() => inputRef.current?.click()}
  >
    <input 
      type="file" 
      accept=".csv" 
      className="hidden" 
      ref={inputRef} 
      onChange={(e) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
      }} 
    />
    {file ? (
      <>
        <CheckCircle className="w-8 h-8 text-emerald-500 mb-3" />
        <h3 className="font-semibold text-emerald-900 mb-1">{file.name}</h3>
        <button 
          className="text-xs text-red-500 hover:underline mt-2 absolute top-2 right-4"
          onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ''; }}
        >
          Remover
        </button>
      </>
    ) : (
      <>
        <UploadCloud className={clsx("w-8 h-8 mb-3", required ? "text-blue-500" : "text-slate-400")} />
        <h3 className="font-semibold text-slate-900 mb-1">
          {title} {required && <span className="text-red-500">*</span>}
        </h3>
        <p className="text-xs text-slate-500 max-w-xs">{desc}</p>
      </>
    )}
  </div>
);

export default function ImportarPage() {
  const router = useRouter();
  const { addReport, spreadsheetId } = useStore();
  const { token } = useAuth();
  const [sheetServers, setSheetServers] = useState<Server[]>([]);
  
  const fileInputReceberRef = useRef<HTMLInputElement>(null);
  const fileInputPagarRef = useRef<HTMLInputElement>(null);
  const fileInputGlosaRef = useRef<HTMLInputElement>(null);
  
  const [fileReceber, setFileReceber] = useState<File | null>(null);
  const [filePagar, setFilePagar] = useState<File | null>(null);
  const [fileGlosa, setFileGlosa] = useState<File | null>(null);
  
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [competencia, setCompetencia] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Upload, 2: Reconciliation
  
  const [receivedTotals, setReceivedTotals] = useState<Record<string, string>>({});
  
  const [selectedServerForJuros, setSelectedServerForJuros] = useState('');
  const [jurosValueStr, setJurosValueStr] = useState('');
  const [jurosObservacao, setJurosObservacao] = useState('');
  
  // Results
  const [fundsTotal, setFundsTotal] = useState<Record<Fund, number>>({
    FUNDO_FINANCEIRO: 0,
    FUNDO_PREVIDENCIARIO: 0,
    NAO_DEFINIDO: 0
  });
  
  const [totals, setTotals] = useState({
    receber: 0,
    pagar: 0,
    glosas: 0,
    liquido: 0
  });
  
  const [newServersCount, setNewServersCount] = useState(0);
  const [reportServers, setReportServers] = useState<ReportServer[]>([]);
  const [paymentDate, setPaymentDate] = useState('');

  const institutionExpectedTotals = useMemo(() => {
    const map = new Map<string, number>();
    reportServers.forEach(s => {
      const dest = s.destinatario || 'NAO_INFORMADO';
      map.set(dest, (map.get(dest) || 0) + (s.value || 0));
    });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [reportServers]);

  const normalizeCpf = (c: string | number) => String(c).replace(/\D/g, '').padStart(11, '0');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const parseCSV = (file: File, type: 'receber' | 'pagar' | 'glosa'): Promise<ParsedRow[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        encoding: 'ISO-8859-1',
        complete: (results) => {
          const data = results.data as string[][];

          // Find global summary if exists
          let summaryPagar = 0;
          let summaryComp = '';
          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (row.length >= 7 && row[1] === 'Solicitante' && row[6] === 'Total') {
              const nextRow = data[i+1];
              if (nextRow && nextRow.length >= 7) {
                const solicitante = nextRow[1];
                const totalStr = nextRow[6] ? String(nextRow[6]).trim().replace(',', '.') : '0';
                const total = parseFloat(totalStr);
                if (solicitante === 'RGPS' && !isNaN(total) && total > 0) {
                  summaryPagar += total;
                  if (!summaryComp) summaryComp = nextRow[0];
                }
              }
            }
          }
          
          // Find the header row (the one containing 'CPF')
          let headerIndex = -1;
          let headers: string[] = [];
          
          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('cpf'))) {
              headerIndex = i;
              headers = row;
              break;
            }
          }

          const extraRows: ParsedRow[] = [];
          // Only extract summaryPagar from the 'receber' file to avoid double-counting if they upload the same file to 'pagar'.
          // Or if they upload a file explicitly to 'pagar' that has no detailed rows.
          if (summaryPagar > 0 && (type === 'receber' || type === 'pagar')) {
             extraRows.push({
              cpf: '00000000000',
              nome: 'Resumo Global - Valores a Pagar',
              origem: 'RGPS',
              valor: summaryPagar,
              competencia: summaryComp || '',
              type: 'pagar',
              destinatario: 'NAO_INFORMADO'
            } as any);
          }

          if (headerIndex === -1) {
            resolve(type === 'receber' ? extraRows : (type === 'pagar' && summaryPagar > 0 ? extraRows : []));
            return;
          }

          const parsedObjects = [];
          for (let i = headerIndex + 1; i < data.length; i++) {
            const row = data[i];
            const obj: Record<string, string> = {};
            headers.forEach((h, index) => {
              if (h) {
                obj[h] = row[index];
              }
            });
            parsedObjects.push(obj);
          }

          const rows: ParsedRow[] = parsedObjects.map((row) => {
            const keys = Object.keys(row);
            
            const getVal = (search: string) => {
              const normalizedSearch = search.toLowerCase().replace(/[^a-z0-9]/g, '');
              
              // First try exact match
              let key = keys.find(k => {
                const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalizedKey === normalizedSearch;
              });

              // Then try startsWith to avoid picking 'valorglosaestoque' instead of 'valorglosa' if we searched for 'valorglosa' (actually exact match fixes this, but fallback is good)
              if (!key) {
                key = keys.find(k => {
                  const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return normalizedKey.includes(normalizedSearch);
                });
              }
              return key ? row[key] : undefined;
            };

            const parseVal = (v: any) => {
              const s = String(v || '0').trim();
              if (!s || s === '-') return 0;
              let cleanStr = s;
              if (s.includes(',')) {
                cleanStr = s.replace(/\./g, '').replace(',', '.');
              }
              const num = parseFloat(cleanStr);
              return isNaN(num) ? 0 : num;
            };

            const comp = getVal('competncia') || getVal('competencia') || '';

            let totalValor = 0;
            const valorTotalCol = parseVal(getVal('valortotal'));

            if (valorTotalCol > 0) {
              totalValor = valorTotalCol;
            } else {
              const valorFluxo = parseVal(getVal('valorfluxomensal')) || parseVal(getVal('valorfluxocalculado'));
              const valor13Fluxo = parseVal(getVal('valor13fluxomensal')) || parseVal(getVal('valor13fluxocalculado'));
              const valorPassivo = parseVal(getVal('valorpassivo'));
              const valor13Passivo = parseVal(getVal('valor13passivo'));
              const valorProRata = parseVal(getVal('valorproratabase')) || parseVal(getVal('prrataatual'));
              
              totalValor = valorFluxo + valor13Fluxo + valorPassivo + valor13Passivo + valorProRata;

              // Fallbacks for files that might have different columns (like 'valorglosa' or just 'valor')
              if (totalValor === 0) {
                const valorGlosa = parseVal(getVal('valorglosa'));
                if (valorGlosa > 0) {
                  totalValor = valorGlosa;
                } else if (getVal('valor')) {
                  totalValor = parseVal(getVal('valor'));
                }
              }
            }

            const cpfRaw = getVal('cpfbeneficirio') || getVal('cpfbeneficiario') || getVal('cpf') || '';
            const observacaoRaw = getVal('motivoglosa') || getVal('observacao') || getVal('observao') || getVal('obs') || '';
            
            let parsedDestinatario = getVal('destinatario') || getVal('destinatrio');
            
            if (type === 'pagar') {
              // Em arquivos 'a pagar', o ente com quem estamos reconciliando é o solicitante
              const sol = getVal('solicitante');
              if (sol) {
                parsedDestinatario = sol.replace(/^[A-Z]{2}\s*-\s*/, '').trim();
              }
            } else if (type === 'glosa') {
              // Em arquivos de glosa, o ente é o beneficiário institucional
              const ben = getVal('beneficirio') || getVal('beneficiario');
              if (ben) {
                parsedDestinatario = ben.replace(/^[A-Z]{2}\s*-\s*/, '').trim();
              }
            }
            
            parsedDestinatario = parsedDestinatario || 'NAO_INFORMADO';
            
            return {
              cpf: cpfRaw.toString().replace(/\D/g, ''),
              nome: getVal('nome') || getVal('nomedobeneficiario') || getVal('nomedobeneficirio') || 'Servidor a Identificar',
              origem: (getVal('origem') || 'RGPS').toUpperCase(),
              valor: totalValor,
              competencia: comp,
              type,
              destinatario: parsedDestinatario,
              observacao: observacaoRaw
            };
          }).filter((r) => r.cpf && r.valor > 0);
          
          resolve([...extraRows, ...rows]);
        },
        error: reject
      });
    });
  };

  const handleProcessFiles = async () => {
    if (!fileReceber) {
      alert('O arquivo de valores a receber (principal) é obrigatório.');
      return;
    }

    setIsProcessing(true);
    
    try {
      const allRows: ParsedRow[] = [];
      
      const receberRows = await parseCSV(fileReceber, 'receber');
      allRows.push(...receberRows);
      
      if (filePagar) {
        const pagarRows = await parseCSV(filePagar, 'pagar');
        allRows.push(...pagarRows);
      }
      
      if (fileGlosa) {
        const glosaRows = await parseCSV(fileGlosa, 'glosa');
        allRows.push(...glosaRows);
      }
      
      let fetchedServers: Server[] = [];
      if (token && spreadsheetId) {
        fetchedServers = await fetchServersFromSheet(token, spreadsheetId);
        setSheetServers(fetchedServers);
      }
      
      let firstComp = '';
      for (const r of allRows) {
        if (r.competencia && !firstComp) {
          firstComp = r.competencia;
          break;
        }
      }
      setCompetencia(firstComp);
      setParsedData(allRows);
      processReconciliation(allRows, fetchedServers);
      setStep(2);
    } catch (error) {
      alert('Erro ao processar arquivos CSV.');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processReconciliation = (rows: ParsedRow[], currentServers: Server[]) => {
    let financeiro = 0;
    let previdenciario = 0;
    let naoDefinido = 0;
    let newCount = 0;
    
    let totalReceber = 0;
    let totalPagar = 0;
    let totalGlosas = 0;
    
    // Aggregate by CPF and Destinatario
    const serverMap = new Map<string, {
      cpf: string;
      name: string;
      origin: string;
      receber: number;
      pagar: number;
      glosa: number;
      destinatario: string;
      observacoes: string[];
    }>();

    rows.forEach(row => {
      if (row.type === 'receber') totalReceber += row.valor;
      else if (row.type === 'pagar') totalPagar += row.valor;
      else if (row.type === 'glosa') totalGlosas += row.valor;

      let dest = (row as any).destinatario || 'NAO_INFORMADO';
      
      // Se não tem destinatário, mas a origem é RGPS, assume RGPS para casar o glosa com o receber
      if (dest === 'NAO_INFORMADO' && row.origem === 'RGPS') {
        dest = 'RGPS';
      }

      const key = `${row.cpf}_${dest}`;

      if (!serverMap.has(key)) {
        serverMap.set(key, {
          cpf: row.cpf,
          name: row.nome,
          origin: row.origem,
          receber: 0,
          pagar: 0,
          glosa: 0,
          destinatario: dest,
          observacoes: []
        });
      }
      
      const s = serverMap.get(key)!;
      if (row.type === 'receber') s.receber += row.valor;
      else if (row.type === 'pagar') s.pagar += row.valor;
      else if (row.type === 'glosa') s.glosa += row.valor;
      
      if (row.observacao) {
        s.observacoes.push(row.observacao);
      }
      
      // Update name if we found a better one than "Servidor a Identificar"
      if (s.name === 'Servidor a Identificar' && row.nome !== 'Servidor a Identificar') {
        s.name = row.nome;
      }
    });

    const activeServersCopy = [...currentServers];
    const rServers: ReportServer[] = [];

    serverMap.forEach((data, key) => {
      const cpf = data.cpf;
      const netValue = data.receber - data.pagar - data.glosa;
      const normalizedRowCpf = normalizeCpf(cpf);
      const existingServer = activeServersCopy.find(s => normalizeCpf(s.cpf) === normalizedRowCpf);
      
      if (existingServer) {
        if (existingServer.fund === 'FUNDO_FINANCEIRO') financeiro += netValue;
        else if (existingServer.fund === 'FUNDO_PREVIDENCIARIO') previdenciario += netValue;
        else naoDefinido += netValue;

        rServers.push({
          cpf: existingServer.cpf,
          name: existingServer.name,
          entryDate: existingServer.entryDate,
          fund: existingServer.fund,
          receber: data.receber,
          pagar: data.pagar,
          glosa: data.glosa,
          value: netValue,
          destinatario: (data as any).destinatario,
          observacao: Array.from(new Set(data.observacoes)).join(' / ')
        });
      } else {
        naoDefinido += netValue;
        newCount++;
        
        activeServersCopy.push({
          id: 'temp-' + cpf,
          cpf: cpf,
          name: data.name,
          origin: data.origin as any,
          status: 'PENDING',
          fund: 'NAO_DEFINIDO'
        });

        rServers.push({
          cpf: cpf,
          name: data.name,
          entryDate: undefined,
          fund: 'NAO_DEFINIDO',
          receber: data.receber,
          pagar: data.pagar,
          glosa: data.glosa,
          value: netValue,
          destinatario: (data as any).destinatario,
          observacao: Array.from(new Set(data.observacoes)).join(' / ')
        });
      }
    });

    setFundsTotal({
      FUNDO_FINANCEIRO: financeiro,
      FUNDO_PREVIDENCIARIO: previdenciario,
      NAO_DEFINIDO: naoDefinido
    });
    
    setTotals({
      receber: totalReceber,
      pagar: totalPagar,
      glosas: totalGlosas,
      liquido: totalReceber - totalPagar - totalGlosas
    });
    
    setNewServersCount(newCount);
    setReportServers(rServers);
  };

  const parseInputValue = (val: string) => {
    if (!val) return 0;
    const cleanStr = val.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  const handleSaveAndProcess = async () => {
    const received = parseInputValue(receivedTotalStr);
    if (isNaN(received) || received === 0) {
      alert('Por favor, informe o valor recebido válido.');
      return;
    }

    // 1. Add pending servers
    const existingCpfs = new Set(sheetServers.map(s => normalizeCpf(s.cpf)));
    const newServersToAppend: Server[] = [];
    
    parsedData.forEach(row => {
      const normalizedRowCpf = normalizeCpf(row.cpf);
      if (!existingCpfs.has(normalizedRowCpf) && normalizedRowCpf !== '00000000000') {
        newServersToAppend.push({
          id: uuidv4(),
          cpf: normalizedRowCpf,
          name: row.nome,
          origin: (row.origem === 'RPPS' ? 'RPPS' : 'RGPS'),
          status: 'PENDING',
          fund: 'NAO_DEFINIDO',
          entryDate: ''
        });
        existingCpfs.add(normalizedRowCpf);
      }
    });

    if (newServersToAppend.length > 0 && token && spreadsheetId) {
      try {
        await batchAppendServersToSheet(token, spreadsheetId, newServersToAppend);
      } catch(e) {
        console.error('Falha ao adicionar novos servidores na planilha:', e);
      }
    }

    // 2. Export Payments to Sheet
    if (token && spreadsheetId && reportServers.length > 0) {
      const importId = `IMP-${Date.now()}`;
      const importDate = new Date().toLocaleString('pt-BR');
      const comp = competencia || new Date().toISOString().substring(0, 7);
      const dateStr = paymentDate || '';
      
      const globalReceivedTotal = Object.values(receivedTotals).reduce((sum, str) => sum + parseInputValue(str), 0);
      
      const expectedTotalStr = totals.liquido.toString().replace('.', ',');
      const receivedTotalStrVal = globalReceivedTotal.toString().replace('.', ',');
      const differenceStr = (totals.liquido - globalReceivedTotal).toString().replace('.', ',');
      
      const paymentRows = reportServers.map(s => {
        const dest = s.destinatario || 'NAO_INFORMADO';
        const instReceivedStr = receivedTotals[dest] || '0';
        const instReceivedVal = parseInputValue(instReceivedStr).toString().replace('.', ',');
        
        return [
        importId,
        importDate,
        comp,
        dateStr,
        expectedTotalStr,
        receivedTotalStrVal,
        differenceStr,
        s.destinatario || 'NAO_INFORMADO',
        `'${s.cpf}`,
        s.name,
        s.origin || 'RGPS',
        s.fund === 'FUNDO_FINANCEIRO' ? 'FF' : s.fund === 'FUNDO_PREVIDENCIARIO' ? 'FP' : '-',
        s.value.toString().replace('.', ','),
        s.receber.toString().replace('.', ','),
        s.pagar.toString().replace('.', ','),
        s.glosa.toString().replace('.', ','),
        s.observacao || '',
        (s.juros || 0).toString().replace('.', ','),
        instReceivedVal
      ]});
      try {
        await batchAppendPaymentsToSheet(token, spreadsheetId, paymentRows);
      } catch(e) {
        console.error('Falha ao exportar pagamentos:', e);
        alert('Falha ao gravar na aba Pagamentos da planilha.');
      }
    }

    // 3. Save Report is no longer needed locally as we read from Sheets
    
    router.push('/');
  };

  const handleApplyJuros = () => {
    const jurosVal = parseInputValue(jurosValueStr);
    if (jurosVal === 0) return alert('Valor de juros inválido');
    if (!selectedServerForJuros) return alert('Selecione um servidor');

    const newServers = [...reportServers];
    const idx = newServers.findIndex(s => s.cpf === selectedServerForJuros);
    if (idx >= 0) {
      newServers[idx].juros = (newServers[idx].juros || 0) + jurosVal;
      newServers[idx].value = (newServers[idx].value || 0) + jurosVal;
      if (jurosObservacao) {
        newServers[idx].observacao = newServers[idx].observacao 
          ? `${newServers[idx].observacao} / Juros: ${jurosObservacao}`
          : `Juros: ${jurosObservacao}`;
      }
      setReportServers(newServers);
      
      setTotals(prev => ({
        ...prev,
        liquido: prev.liquido + jurosVal
      }));
      
      const fund = newServers[idx].fund;
      setFundsTotal(prev => ({
        ...prev,
        [fund]: prev[fund] + jurosVal
      }));
      
      setJurosValueStr('');
      setJurosObservacao('');
      setSelectedServerForJuros('');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Importar Fluxos Mensais</h1>
        <p className="text-slate-500">Faça o upload dos arquivos do Comprev para reconciliação.</p>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FileBox 
              title="Valores a Receber" 
              desc="CSV principal com os valores que o fundo tem a receber (Obrigatório)"
              file={fileReceber}
              setFile={setFileReceber}
              inputRef={fileInputReceberRef}
              required
            />
            <FileBox 
              title="Valores a Pagar" 
              desc="CSV com os valores devidos a outros regimes (Opcional)"
              file={filePagar}
              setFile={setFilePagar}
              inputRef={fileInputPagarRef}
            />
            <FileBox 
              title="Glosas" 
              desc="CSV com as glosas e descontos do mês (Opcional)"
              file={fileGlosa}
              setFile={setFileGlosa}
              inputRef={fileInputGlosaRef}
            />
          </div>
          
          <div className="flex justify-end pt-6 border-t border-slate-200">
            <button 
              onClick={handleProcessFiles}
              disabled={!fileReceber || isProcessing}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? 'Processando arquivos...' : 'Processar Arquivos'}
              {!isProcessing && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Resumo do Processamento</h3>
                <p className="text-slate-500 text-sm">
                  {parsedData.length} registros no total • Competência {competencia}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-blue-500" />
                  Composição do Valor (CSV)
                </h4>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Total a Receber</span>
                    <span className="font-bold text-slate-900">{formatCurrency(totals.receber)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Total a Pagar</span>
                    <span className="font-bold text-red-600">- {formatCurrency(totals.pagar)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Total de Glosas</span>
                    <span className="font-bold text-red-600">- {formatCurrency(totals.glosas)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-800 text-white rounded-lg mt-2">
                    <span className="font-medium">Total Esperado (Líquido)</span>
                    <span className="font-bold text-lg">{formatCurrency(totals.liquido)}</span>
                  </div>
                </div>

                <h4 className="font-semibold text-slate-700 mb-4 mt-8 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-emerald-500" />
                  Distribuição Líquida por Fundo
                </h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Fundo Financeiro</span>
                    <span className="font-bold text-indigo-700">{formatCurrency(fundsTotal.FUNDO_FINANCEIRO)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Fundo Previdenciário</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(fundsTotal.FUNDO_PREVIDENCIARIO)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div>
                      <span className="text-sm font-medium text-amber-800 block">Não Definido</span>
                      <span className="text-xs text-amber-600">{newServersCount} novos servidores (pendentes)</span>
                    </div>
                    <span className="font-bold text-amber-700">{formatCurrency(fundsTotal.NAO_DEFINIDO)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  Reconciliação Bancária
                </h4>
                
                <div className="mb-4">
                  {institutionExpectedTotals.map(inst => {
                    const received = parseInputValue(receivedTotals[inst.name] || '0');
                    const diff = inst.total - received;
                    return (
                      <div key={inst.name} className="mb-4 p-4 border border-slate-200 rounded-lg bg-white">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="font-bold text-slate-800">{inst.name}</h5>
                          <span className="text-sm font-medium text-slate-500">Esperado: {formatCurrency(inst.total)}</span>
                        </div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Valor Recebido na Conta (R$)</label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={receivedTotals[inst.name] || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.,]/g, '');
                            setReceivedTotals(prev => ({ ...prev, [inst.name]: val }));
                          }}
                          className="w-full text-lg px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-900"
                        />
                        {(receivedTotals[inst.name] && !isNaN(received) && received > 0 && Math.abs(diff) > 0.01) && (
                          <div className="mt-2 text-sm font-medium text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> Diferença: {formatCurrency(diff)}
                          </div>
                        )}
                        {(receivedTotals[inst.name] && !isNaN(received) && received > 0 && Math.abs(diff) <= 0.01) && (
                          <div className="mt-2 text-sm font-medium text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Bateu perfeitamente!
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Data do Pagamento (Opcional)</label>
                  <input
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={paymentDate}
                    onChange={e => {
                      let val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      if (val.length >= 5) {
                        val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
                      } else if (val.length >= 3) {
                        val = `${val.slice(0, 2)}/${val.slice(2)}`;
                      }
                      setPaymentDate(val);
                    }}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                  />
                </div>

                {(() => {
                  const hasAnyInput = Object.values(receivedTotals).some(val => parseInputValue(val) > 0);
                  const globalReceived = Object.values(receivedTotals).reduce((sum, val) => sum + parseInputValue(val), 0);
                  const globalDiff = totals.liquido - globalReceived;
                  
                  if (!hasAnyInput) return null;

                  return (
                    <div className={clsx(
                      "p-4 rounded-lg border flex items-start gap-3 mt-4",
                      Math.abs(globalDiff) < 0.01 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                        : "bg-red-50 border-red-200 text-red-800"
                    )}>
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">
                          Diferença Global: {formatCurrency(globalDiff)}
                        </p>
                        <p className="text-sm opacity-90">
                          {Math.abs(globalDiff) < 0.01 
                            ? "A soma de todos os recebimentos bate com o líquido. Você pode prosseguir."
                            : "Há uma divergência global. Verifique antes de prosseguir."}
                        </p>
                      </div>
                    </div>
                  );
                })()}
                
                {(() => {
                  const hasAnyInput = Object.values(receivedTotals).some(val => parseInputValue(val) > 0);
                  const globalReceived = Object.values(receivedTotals).reduce((sum, val) => sum + parseInputValue(val), 0);
                  const globalDiff = totals.liquido - globalReceived;
                  
                  if (!hasAnyInput || Math.abs(globalDiff) <= 0.01) return null;
                  
                  return (
                    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                      <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        Justificar Diferença (Juros/Correção)
                      </h4>
                      <p className="text-sm text-slate-600 mb-4">
                        Se o pagamento foi feito com atraso e há juros ou atualização monetária, atribua a diferença a um servidor. O valor líquido esperado aumentará.
                      </p>
                      
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Servidor</label>
                          <select 
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={selectedServerForJuros}
                            onChange={e => setSelectedServerForJuros(e.target.value)}
                          >
                            <option value="">Selecione um servidor...</option>
                            {reportServers.map(s => (
                              <option key={s.cpf} value={s.cpf}>{s.name} ({s.cpf} - {s.destinatario || 'RGPS'})</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Valor dos Juros (R$)</label>
                            <input
                              type="text"
                              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="R$ 0,00"
                              value={jurosValueStr}
                              onChange={e => setJurosValueStr(e.target.value.replace(/[^0-9.,\-]/g, ''))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / Obs</label>
                            <input
                              type="text"
                              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Ex: Juros por atraso"
                              value={jurosObservacao}
                              onChange={e => setJurosObservacao(e.target.value)}
                            />
                          </div>
                        </div>
                        <button
                          onClick={handleApplyJuros}
                          disabled={!selectedServerForJuros || !jurosValueStr}
                          className="w-full mt-2 bg-slate-800 text-white rounded-lg p-2.5 text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
                        >
                          Adicionar Ajuste
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => { setStep(1); }}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button 
                onClick={handleSaveAndProcess}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Confirmar Processamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
