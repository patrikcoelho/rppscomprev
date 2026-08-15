'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';
import { fetchSheetData, writeConfrontoResultsToSheet } from '@/lib/sheets';
import { AlertCircle, CheckCircle2, Search, Loader2 } from 'lucide-react';

interface RowData {
  [key: string]: any;
}

interface ConfrontoItem {
  cpf: string;
  name: string;
  origem: string;
  status: string;
  listaStatus?: string;
}

const STATUS_OPTIONS = [
  'Não Realizado',
  'Em Análise',
  'Requerimento Enviado',
  'Aguardando Documentação',
  'Concluído'
];

export default function ConfrontoPage() {
  const { spreadsheetId, setConfrontoStatus } = useStore();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ConfrontoItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!token || !spreadsheetId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const [censo, aposentadorias, averbacoes, listaComprev, confrontoSheet] = await Promise.all([
          fetchSheetData(token, spreadsheetId, 'Censo'),
          fetchSheetData(token, spreadsheetId, 'Aposentadorias'),
          fetchSheetData(token, spreadsheetId, 'Averbacoes'),
          fetchSheetData(token, spreadsheetId, 'Lista_comprev'),
          fetchSheetData(token, spreadsheetId, 'Confronto')
        ]);
        
        const cleanCpf = (str: any) => (str ? String(str).replace(/[^\d]/g, '') : '');
        const normalizeCpfForMatch = (str: any) => {
          const digits = cleanCpf(str);
          return digits ? digits.padStart(11, '0').slice(-11) : '';
        };
        const formatCpfForDisplay = (str: any) => normalizeCpfForMatch(str);
        const getFirstRowValue = (row: RowData, keys: string[]) => {
          for (const key of keys) {
            const value = row[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              return value;
            }
          }
          return '';
        };
        const getCpfRaw = (row: RowData) => getFirstRowValue(row, [
          'CPF',
          'CPF Beneficiário',
          'CPF_BENEFICIARIO',
          'CPF_INSTITUIDOR',
          'CPF do Beneficiário',
          'CPF do Beneficiário(a)',
          'CPF do Servidor'
        ]);
        const getCpf = (row: RowData) => normalizeCpfForMatch(getCpfRaw(row));
        const isStatusLike = (value: any) => {
          const text = String(value || '').trim().toLowerCase();
          return [
            'não realizado',
            'nao realizado',
            'em análise',
            'em analise',
            'requerimento enviado',
            'aguardando documentação',
            'aguardando documentacao',
            'concluído',
            'concluido'
          ].includes(text);
        };
        const extractStatus = (row: RowData) => {
          const explicit = getFirstRowValue(row, [
            'STATUS',
            'Status',
            'SITUAÇÃO',
            'SITUACAO',
            'Situação',
            'SITUAÇÃO DO REQUERIMENTO',
            'SITUACAO DO REQUERIMENTO',
            'STATUS DO REQUERIMENTO',
            'STATUS_REQUERIMENTO',
            'STATUS REQUERIMENTO',
            'SITUAÇÃO REQUERIMENTO'
          ]);

          if (explicit) {
            return String(explicit).trim();
          }

          const fallback = Object.values(row).find(isStatusLike);
          return fallback ? String(fallback).trim() : '';
        };
        const getName = (row: RowData) => String(
          row['NOME_BENEFICIARIO'] ||
          row['Nome Beneficiário'] ||
          row['NOME_INSTITUIDOR'] ||
          row['NOME'] ||
          row['Nome'] ||
          ''
        ).trim();

        const buildNameMap = (rows: RowData[]) => {
          const map = new Map<string, string>();
          rows.forEach(row => {
            const cpf = getCpf(row);
            const name = getName(row);
            if (cpf && name) {
              map.set(cpf, name);
            }
          });
          return map;
        };

        // 1. Mapas auxiliares para cruzamento e enriquecimento de dados
        const censoMap = buildNameMap(censo);
        const aposentadoriasMap = buildNameMap(aposentadorias);

        // 2. Averbações são a base principal do confronto
        const averbacoesMap = new Map<string, RowData>();
        averbacoes.forEach(row => {
          const cpfKey = getCpf(row);
          const totalDiasRaw = getFirstRowValue(row, ['TOTAL_DIAS', 'Total_Dias', 'Total Dias', 'total_dias']);
          const totalDias = Number(String(totalDiasRaw).replace(',', '.').trim() || '0');
          if (cpfKey && !Number.isNaN(totalDias) && totalDias !== 0) {
            averbacoesMap.set(cpfKey, row);
          }
        });

        // 3. Lista Comprev (status por CPF, tolerando zeros à esquerda suprimidos)
        const listaComprevMap = new Map<string, { status: string; row: RowData }>();
        listaComprev.forEach(row => {
          const cpfKey = getCpf(row);
          const status = extractStatus(row);

          if (cpfKey) {
            const current = listaComprevMap.get(cpfKey);
            if (!current || status) {
              listaComprevMap.set(cpfKey, { status: status || current?.status || '', row });
            }
          }
        });

        const confrontoStatusMap = new Map<string, string>();
        confrontoSheet.forEach(row => {
          const cpfKey = getCpf(row);
          const status = String(getFirstRowValue(row, ['Status Confronto', 'Status', 'status'])).trim();
          if (cpfKey) {
            if (status) {
              confrontoStatusMap.set(cpfKey, status);
            }
          }
        });

        // CRUZAMENTO PRINCIPAL: Averbações + status da Lista Comprev quando existir
        const resultadosMap = new Map<string, ConfrontoItem>();
        
        averbacoesMap.forEach((row, cpf) => {
          const listaItem = listaComprevMap.get(cpf);
          if (listaItem) {
            return;
          }

          const name = getName(row) || (listaItem?.row ? getName(listaItem.row) : '') || aposentadoriasMap.get(cpf) || censoMap.get(cpf) || 'Desconhecido';
          const displayCpf = formatCpfForDisplay(getCpfRaw(row) || cpf);
          const listaStatus = listaItem?.status || 'Não Realizado';
          const status = confrontoStatusMap.get(cpf) || confrontoStatusMap.get(displayCpf) || listaStatus;

          const current = resultadosMap.get(displayCpf);
          const nextItem: ConfrontoItem = {
            cpf: displayCpf,
            name,
            origem: 'Averbacoes',
            status,
            listaStatus
          };

          if (!current) {
            resultadosMap.set(displayCpf, nextItem);
            return;
          }

          resultadosMap.set(displayCpf, {
            ...current,
            name: current.name && current.name !== 'Desconhecido' ? current.name : nextItem.name,
            status: current.status && current.status !== 'Não Realizado' ? current.status : nextItem.status,
            listaStatus: current.listaStatus || nextItem.listaStatus
          });
        });

        const resultados = Array.from(resultadosMap.values());
        
        setItems(resultados);
        void writeConfrontoResultsToSheet(
          token,
          spreadsheetId,
          resultados.map(item => ({
            cpf: item.cpf,
            nome: item.name,
            origem: item.origem,
            statusConfronto: item.status,
            statusListaComprev: item.listaStatus || '',
            updatedAt: new Date().toISOString()
          }))
        ).catch((writeErr) => {
          console.error(writeErr);
        });
      } catch (err) {
        console.error(err);
        setError('Ocorreu um erro ao buscar os dados da planilha. Verifique as permissões e se as abas existem.');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [token, spreadsheetId]); // Omit confrontoData to avoid infinite loop on status change

  const handleStatusChange = (cpf: string, newStatus: string) => {
    setConfrontoStatus(cpf, newStatus);
    const nextItems = items.map(item => (
      item.cpf === cpf ? { ...item, status: newStatus } : item
    ));
    setItems(nextItems);

    if (token && spreadsheetId) {
      void writeConfrontoResultsToSheet(
        token,
        spreadsheetId,
        nextItems.map(item => ({
          cpf: item.cpf,
          nome: item.name,
          origem: item.origem,
          statusConfronto: item.status,
          statusListaComprev: item.listaStatus || '',
          updatedAt: new Date().toISOString()
        }))
      ).catch((err) => {
        console.error(err);
        setError('Não foi possível salvar a alteração na aba de confronto.');
      });
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.cpf.includes(searchTerm)
  );

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  if (!token) {
    return <div className="p-8 text-center text-slate-500">Faça login para acessar o confronto.</div>;
  }

  if (!spreadsheetId) {
    return <div className="p-8 text-center text-slate-500">Configure o ID da planilha nas configurações primeiro.</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Confronto Comprev</h1>
          <p className="text-slate-500">Identifique aposentados com averbação, preservando o status da lista e o status manual na aba de confronto.</p>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-md flex items-start gap-3 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Lendo dados e calculando cruzamentos...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Requerimentos Pendentes</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {items.filter(i => i.status === 'Não Realizado').length}
                </h3>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Em Andamento</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {items.filter(i => i.status !== 'Não Realizado' && i.status !== 'Concluído').length}
                </h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Concluídos Manualmente</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {items.filter(i => i.status === 'Concluído').length}
                </h3>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Resultado do Cruzamento</h2>
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou CPF..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-medium">Servidor</th>
                    <th className="px-6 py-4 font-medium">CPF</th>
                    <th className="px-6 py-4 font-medium">Situação / Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                        Nenhum servidor pendente encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.cpf} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Registro base identificado via {item.origem}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono">
                          {formatCpf(item.cpf)}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.cpf, e.target.value)}
                            className={`px-3 py-1.5 rounded-md border text-sm font-medium w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors ${
                              item.status === 'Não Realizado' ? 'bg-red-50 text-red-700 border-red-200' :
                              item.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {Array.from(new Set([item.status, ...STATUS_OPTIONS])).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
