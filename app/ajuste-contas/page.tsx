'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, DollarSign, ArrowRight } from 'lucide-react';
import { fetchAjustesFromSheet, writeAjustesToSheet, AjusteContaRow } from '@/lib/sheets';
import Papa from 'papaparse';

export default function AjusteContasPage() {
  const { spreadsheetId } = useStore();
  const { token } = useAuth();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [ajustes, setAjustes] = useState<AjusteContaRow[]>([]);
  
  // Para armazenar valores sendo digitados antes de salvar
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    if (spreadsheetId && token) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [spreadsheetId, token]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAjustesFromSheet(token!, spreadsheetId!);
      setAjustes(data);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'TOKEN_EXPIRED') {
        setFeedback({ type: 'error', message: 'Sua sessão expirou. Faça login novamente.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  };

  const parseNumber = (val: string | number | undefined | null) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    
    const str = val.toString().trim();
    if (str.includes(',') && !str.includes('.')) {
      return parseFloat(str.replace(',', '.')) || 0;
    } else if (str.includes(',') && str.includes('.')) {
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      if (lastComma > lastDot) {
        // Formato BR: 1.234,56
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        // Formato US: 1,234.56
        return parseFloat(str.replace(/,/g, '')) || 0;
      }
    }
    // Formato US sem separador de milhar: 1234.56
    return parseFloat(str) || 0;
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setFeedback({ type: 'error', message: 'Por favor, envie um arquivo CSV válido.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    Papa.parse(file, {
      encoding: 'ISO-8859-1', // Padrão BG-Comprev
      complete: async (results) => {
        try {
          const rows = results.data as any[][];
          if (rows.length < 2) throw new Error('Arquivo vazio ou formato inválido.');
          
          // Encontrar a linha de cabeçalho
          let headerIndex = -1;
          for (let i = 0; i < Math.min(10, rows.length); i++) {
            if (rows[i] && rows[i].some(c => typeof c === 'string' && c.toLowerCase().includes('compet'))) {
              headerIndex = i;
              break;
            }
          }
          
          if (headerIndex === -1) throw new Error('Cabeçalho não encontrado no arquivo CSV.');
          
          const headers = rows[headerIndex].map(h => String(h || '').trim().toLowerCase());
          
          // Identificar formato do CSV
          const isLayout1 = headers.includes('nome participante - uf') && headers.includes('saldo a receber');
          const isLayout2 = headers.includes('participante com saldo a receber') && headers.includes('participante 1');
          
          if (!isLayout1 && !isLayout2) {
            throw new Error('Formato de CSV desconhecido. Por favor, envie o resumo contábil ou detalhado do ajuste de contas.');
          }

          const parsedRows: AjusteContaRow[] = [];
          const now = new Date().toISOString();

          for (let i = headerIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 2 || !row[0]) continue;
            
            let competencia = String(row[0]).trim();
            if (!competencia.match(/^\d{2}\/\d{4}$/)) continue; // Pular rodapés
            
            let entidade = '';
            let cnpj = '';
            let tipo: 'RECEBER' | 'PAGAR' = 'RECEBER';
            let valorEsperado = 0;

            if (isLayout1) {
              const idxEntidade = headers.indexOf('nome participante - uf');
              const idxCnpj = headers.indexOf('cnpj rpps participante');
              const idxSaldoReceber = headers.findIndex(h => h.includes('saldo a receber'));
              const idxSaldoPagar = headers.findIndex(h => h.includes('saldo a pagar'));
              
              entidade = row[idxEntidade]?.trim() || '';
              cnpj = row[idxCnpj]?.trim() || '';
              const saldoReceber = parseNumber(row[idxSaldoReceber]);
              const saldoPagar = parseNumber(row[idxSaldoPagar]);
              
              if (saldoReceber > 0) {
                tipo = 'RECEBER';
                valorEsperado = saldoReceber;
              } else if (saldoPagar > 0) {
                tipo = 'PAGAR';
                valorEsperado = saldoPagar;
              } else {
                continue; // Zerado
              }
            } else if (isLayout2) {
               const idxPart1 = headers.findIndex(h => h === 'participante 1' || h === 'participante 1');
               const idxPart2 = headers.findIndex(h => h === 'participante 2' || h === 'participante 2');
               const idxPartReceber = headers.findIndex(h => h === 'participante com saldo a receber');
               const idxSaldo = headers.findIndex(h => h === 'saldo competência' || h.includes('saldo compet'));
               
               const p1 = String(row[idxPart1] || '').trim();
               const p2 = String(row[idxPart2] || '').trim();
               const pReceber = String(row[idxPartReceber] || '').trim();
               const saldo = parseNumber(row[idxSaldo]);
               
               if (saldo <= 0) continue;
               
               const isWeReceiving = p1 !== 'RGPS' && p2 !== 'RGPS' ? (pReceber !== p1 ? p1 : p2) : pReceber !== 'RGPS'; // simplificação
               entidade = p1 === pReceber ? p2 : p1; 
               
               tipo = pReceber !== entidade ? 'RECEBER' : 'PAGAR';
               valorEsperado = saldo;
            }

            if (valorEsperado > 0 && entidade) {
              parsedRows.push({
                id: `${competencia}-${entidade.replace(/\s+/g, '')}-${tipo}`,
                competencia,
                entidade,
                cnpj,
                tipo,
                valorEsperado,
                valorRealizado: 0,
                status: 'Pendente',
                updatedAt: now
              });
            }
          }
          
          if (parsedRows.length === 0) {
            throw new Error('Nenhum ajuste de contas encontrado no arquivo.');
          }

          // Mesclar com os existentes
          const existingMap = new Map(ajustes.map(a => [a.id, a]));
          let novasCriadas = 0;
          let atualizadas = 0;

          for (const row of parsedRows) {
            if (existingMap.has(row.id)) {
              const existing = existingMap.get(row.id)!;
              if (existing.valorEsperado !== row.valorEsperado) {
                existing.valorEsperado = row.valorEsperado;
                existing.updatedAt = now;
                atualizadas++;
              }
            } else {
              existingMap.set(row.id, row);
              novasCriadas++;
            }
          }
          
          if (novasCriadas === 0 && atualizadas === 0) {
            setFeedback({ type: 'success', message: 'Nenhum novo ajuste para importar (todos já existem e estão atualizados).' });
            setIsProcessing(false);
            return;
          }

          const combined = Array.from(existingMap.values());
          
          await writeAjustesToSheet(token!, spreadsheetId!, combined);
          setAjustes(combined);
          
          const msg = [];
          if (novasCriadas > 0) msg.push(`${novasCriadas} novos ajustes criados`);
          if (atualizadas > 0) msg.push(`${atualizadas} ajustes atualizados`);
          
          setFeedback({ type: 'success', message: msg.join(' e ') + ' com sucesso!' });
        } catch (err: any) {
          console.error(err);
          if (err.message === 'TOKEN_EXPIRED') {
            setFeedback({ type: 'error', message: 'Sua sessão expirou ou você não tem permissão de Editor na planilha. Por favor, recarregue a página, faça login novamente e certifique-se de que a conta Google utilizada tem acesso de edição à planilha.' });
          } else {
            setFeedback({ type: 'error', message: err.message || 'Erro ao processar o arquivo CSV.' });
          }
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error) => {
        setFeedback({ type: 'error', message: `Erro ao ler arquivo: ${error.message}` });
        setIsProcessing(false);
      }
    });
  };

  const handleValueChange = (id: string, value: string) => {
    const num = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
    setEditValues(prev => ({ ...prev, [id]: num }));
  };

  const handleSaveRealizado = async (row: AjusteContaRow) => {
    if (!spreadsheetId || !token) return;
    
    const newVal = editValues[row.id];
    if (newVal === undefined) return;

    try {
      const updatedRow = { ...row, valorRealizado: newVal, status: newVal >= row.valorEsperado - 0.01 ? 'Concluído' : 'Pendente' } as AjusteContaRow;
      const newAjustes = ajustes.map(a => a.id === row.id ? updatedRow : a);
      
      await writeAjustesToSheet(token, spreadsheetId, newAjustes);
      setAjustes(newAjustes);
      
      const newEditValues = { ...editValues };
      delete newEditValues[row.id];
      setEditValues(newEditValues);
      
      setFeedback({ type: 'success', message: 'Valor atualizado com sucesso!' });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Erro ao salvar valor.' });
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Agrupar por competência
  const ajustesPorCompetencia = ajustes.reduce((acc, curr) => {
    if (!acc[curr.competencia]) acc[curr.competencia] = [];
    acc[curr.competencia].push(curr);
    return acc;
  }, {} as Record<string, AjusteContaRow[]>);

  const competencias = Object.keys(ajustesPorCompetencia).sort((a, b) => {
    const [ma, ya] = a.split('/');
    const [mb, yb] = b.split('/');
    return new Date(Number(yb), Number(mb) - 1).getTime() - new Date(Number(ya), Number(ma) - 1).getTime();
  });

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Ajuste de Contas</h1>
        <p className="text-slate-500">Importe o resumo contábil do BG-Comprev para acompanhar as previsões de recebimento e pagamento.</p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm mb-8">
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }`}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <input 
            id="file-upload" 
            type="file" 
            accept=".csv" 
            className="hidden" 
            onChange={handleFileSelect}
          />
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Processando arquivo CSV...</p>
              <p className="text-sm text-slate-400 mt-1">Isso pode levar alguns instantes.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <p className="text-slate-700 font-medium text-lg">Clique ou arraste o arquivo CSV do Ajuste de Contas (Resumo Contábil)</p>
              <p className="text-slate-500 mt-2 text-sm">Formato suportado: .csv (BG-Comprev)</p>
            </div>
          )}
        </div>
        
        {feedback && (
          <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium text-sm">{feedback.message}</span>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {competencias.map(comp => (
          <div key={comp} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Competência: {comp}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-white text-slate-500 uppercase font-semibold text-xs border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Entidade</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4 text-right">Valor Esperado</th>
                    <th className="px-6 py-4 text-right">Valor Realizado</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ajustesPorCompetencia[comp].map(row => {
                    const isReceiving = row.tipo === 'RECEBER';
                    const hasEdit = editValues[row.id] !== undefined;
                    const currentValue = hasEdit ? editValues[row.id] : row.valorRealizado;
                    
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{row.entidade}</p>
                          {row.cnpj && <p className="text-xs text-slate-400 mt-0.5">{row.cnpj}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${isReceiving ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {row.tipo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-700">
                          {formatCurrency(row.valorEsperado)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <input 
                            type="number"
                            value={currentValue || ''}
                            onChange={(e) => handleValueChange(row.id, e.target.value)}
                            placeholder="0,00"
                            className="w-32 text-right px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700 font-medium"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${row.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            disabled={!hasEdit}
                            onClick={() => handleSaveRealizado(row)}
                            className={`px-3 py-1.5 rounded font-medium text-xs transition-colors ${hasEdit ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                          >
                            Salvar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {competencias.length === 0 && !isLoading && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
            <p className="text-slate-500">Nenhum ajuste de contas importado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
