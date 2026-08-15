'use client';
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';
import { fetchSheetData, parseSheetDate, writeConfrontoResultsToSheet } from '@/lib/sheets';
import { AlertCircle, CheckCircle2, Search, Loader2 } from 'lucide-react';

interface RowData {
  [key: string]: any;
}

interface ConfrontoItem {
  cpf: string;
  name: string;
  dataInicioBeneficio: string;
  origem: string;
  status: string;
  listaStatus?: string;
}

const STATUS_OPTIONS = [
  'Não Realizado',
  'Em Análise',
  'Requerimento Enviado',
  'Aguardando Documentação',
  'Concluído',
  'Fora do prazo',
  'Não se aplica',
  'Militar',
  'Sem cadastro Sisprev',
  'Localizar processo de averbação'
];

const STATUS_STYLES: Record<string, string> = {
  'Não Realizado': 'bg-slate-100 text-slate-700 border-slate-300',
  'Em Análise': 'bg-sky-50 text-sky-700 border-sky-200',
  'Requerimento Enviado': 'bg-violet-50 text-violet-700 border-violet-200',
  'Aguardando Documentação': 'bg-amber-50 text-amber-800 border-amber-200',
  'Concluído': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Fora do prazo': 'bg-orange-50 text-orange-700 border-orange-200',
  'Não se aplica': 'bg-slate-100 text-slate-700 border-slate-300',
  'Militar': 'bg-green-100 text-green-800 border-green-300',
  'Sem cadastro Sisprev': 'bg-rose-50 text-rose-700 border-rose-200',
  'Localizar processo de averbação': 'bg-indigo-50 text-indigo-700 border-indigo-200'
};

export default function ConfrontoPage() {
  const { spreadsheetId, setConfrontoStatus } = useStore();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ConfrontoItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('Todos');
  const [selectedStatus, setSelectedStatus] = useState('Todos');

  useEffect(() => {
    async function loadData() {
      if (!token || !spreadsheetId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const [censo, aposentadorias, pensionistas, averbacoes, listaComprev, confrontoSheet] = await Promise.all([
          fetchSheetData(token, spreadsheetId, 'Censo'),
          fetchSheetData(token, spreadsheetId, 'Aposentadorias'),
          fetchSheetData(token, spreadsheetId, 'Pensionistas'),
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
          row['NOME'] ||
          row['Nome'] ||
          ''
        ).trim();
        const getDataIniBeneficio = (row: RowData) => {
          const raw = getFirstRowValue(row, [
            'DATA_INI_BENEFICIO',
            'Data_INI_BENEFICIO',
            'DATA INI BENEFICIO',
            'DATA_INI',
            'DATA DE INI BENEFICIO'
          ]);
          return raw ? parseSheetDate(raw) : '';
        };

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

        const buildAposentadoriasMap = (rows: RowData[]) => {
          const map = new Map<string, { name: string; dataInicioBeneficio: string }>();
          rows.forEach(row => {
            const cpf = getCpf(row);
            const name = getName(row);
            if (cpf) {
              map.set(cpf, {
                name,
                dataInicioBeneficio: getDataIniBeneficio(row)
              });
            }
          });
          return map;
        };

        const buildPensionistasMap = (rows: RowData[]) => {
          const map = new Map<string, { name: string; dataInicioBeneficio: string }>();
          rows.forEach(row => {
            const cpf = getCpf(row);
            const name = getName(row);
            if (cpf) {
              map.set(cpf, {
                name,
                dataInicioBeneficio: getDataIniBeneficio(row)
              });
            }
          });
          return map;
        };

        // 1. Mapas auxiliares para cruzamento e enriquecimento de dados
        const censoMap = buildNameMap(censo);
        const aposentadoriasMap = buildAposentadoriasMap(aposentadorias);
        const pensionistasMap = buildPensionistasMap(pensionistas);

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

        const existingConfrontoMap = new Map<string, ConfrontoItem>();
        confrontoSheet.forEach(row => {
          const cpf = getCpf(row);
          if (!cpf) return;

          const existingItem: ConfrontoItem = {
            cpf: formatCpfForDisplay(getCpfRaw(row) || cpf),
            name: String(getFirstRowValue(row, ['Nome', 'NOME'])).trim() || 'Desconhecido',
            dataInicioBeneficio: String(getFirstRowValue(row, ['Data Início Benefício', 'Data Início Beneficio', 'Data Inicio Beneficio', 'Data Inicio Benefício'])).trim(),
            origem: String(getFirstRowValue(row, ['Origem'])).trim() || 'Averbacoes',
            status: String(getFirstRowValue(row, ['Status Confronto', 'Status', 'status'])).trim() || 'Não Realizado',
            listaStatus: String(getFirstRowValue(row, ['Status Lista Comprev', 'Lista Status', 'Status Lista'])).trim() || ''
          };

          existingConfrontoMap.set(cpf, existingItem);
        });

        // CRUZAMENTO PRINCIPAL: conserva o que já está salvo e enriquece com a base atual
        const resultadosMap = new Map<string, ConfrontoItem>();

        existingConfrontoMap.forEach((item, cpf) => {
          resultadosMap.set(cpf, item);
        });

        averbacoesMap.forEach((row, cpf) => {
          const listaItem = listaComprevMap.get(cpf);
          if (listaItem) return;

          const aposentadoriaInfo = aposentadoriasMap.get(cpf);
          const pensionistaInfo = pensionistasMap.get(cpf);
          const name = getName(row) || aposentadoriaInfo?.name || pensionistaInfo?.name || censoMap.get(cpf) || 'Desconhecido';
          const dataInicioBeneficio = aposentadoriaInfo?.dataInicioBeneficio || pensionistaInfo?.dataInicioBeneficio || '';
          const displayCpf = formatCpfForDisplay(getCpfRaw(row) || cpf);
          const listaStatus = listaItem?.status || 'Não Realizado';
          const existingItem = resultadosMap.get(cpf);

          const nextItem: ConfrontoItem = {
            cpf: displayCpf,
            name,
            dataInicioBeneficio,
            origem: 'Averbacoes',
            status: existingItem?.status || listaStatus,
            listaStatus
          };

          if (!existingItem) {
            resultadosMap.set(cpf, nextItem);
            return;
          }

          resultadosMap.set(cpf, {
            ...existingItem,
            cpf: displayCpf,
            name: existingItem.name && existingItem.name !== 'Desconhecido' ? existingItem.name : nextItem.name,
            dataInicioBeneficio: existingItem.dataInicioBeneficio || nextItem.dataInicioBeneficio,
            origem: existingItem.origem || nextItem.origem,
            status: existingItem.status || nextItem.status,
            listaStatus: existingItem.listaStatus || nextItem.listaStatus
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
            dataInicioBeneficio: item.dataInicioBeneficio,
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
          dataInicioBeneficio: item.dataInicioBeneficio,
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

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getYearFromDataInicioBeneficio = (value: string) => {
    const match = value.match(/(\d{4})(?!.*\d{4})/);
    return match?.[1] || '';
  };

  const yearOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        items
          .map((item) => getYearFromDataInicioBeneficio(item.dataInicioBeneficio))
          .filter(Boolean)
      )
    ).sort((a, b) => Number(b) - Number(a));

    return ['Todos', ...years];
  }, [items]);

  const statusFilterOptions = useMemo(() => {
    const statuses = Array.from(
      new Set([
        ...STATUS_OPTIONS,
        ...items.map((item) => item.status).filter(Boolean)
      ])
    );

    return ['Todos', ...statuses];
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.cpf.includes(normalizedSearch);

      const itemYear = getYearFromDataInicioBeneficio(item.dataInicioBeneficio);
      const matchesYear = selectedYear === 'Todos' || itemYear === selectedYear;
      const matchesStatus = selectedStatus === 'Todos' || item.status === selectedStatus;

      return matchesSearch && matchesYear && matchesStatus;
    });
  }, [items, searchTerm, selectedYear, selectedStatus]);

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
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">Resultado do Cruzamento</h2>
                <p className="text-xs text-slate-500 mt-1">Filtre por nome, CPF, ano de início do benefício e situação.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou CPF..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full sm:w-40 px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year === 'Todos' ? 'Todos os anos' : year}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full sm:w-56 px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {statusFilterOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === 'Todos' ? 'Todas as situações' : status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-medium">Servidor</th>
                    <th className="px-6 py-4 font-medium">CPF</th>
                    <th className="px-6 py-4 font-medium">Início Aposentadoria</th>
                    <th className="px-6 py-4 font-medium">Situação / Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
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
                        <td className="px-6 py-4 text-slate-600">
                          {item.dataInicioBeneficio || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.cpf, e.target.value)}
                            className={`px-3 py-1.5 rounded-md border text-sm font-medium w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors ${STATUS_STYLES[item.status] || 'bg-slate-50 text-slate-700 border-slate-200'}`}
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
