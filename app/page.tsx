'use client';

import { useStore } from '@/lib/store';
import { 
  FileText, 
  AlertCircle, 
  TrendingUp,
  FileBox,
  ArrowRight,
  Loader2,
  DollarSign,
  Landmark,
  PiggyBank,
  BarChart2,
  Table as TableIcon
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import { useState, useEffect, useMemo } from 'react';
import { fetchImportsFromSheet, ImportSummary } from '@/lib/sheets';

const DashboardChart = dynamic(() => import('@/components/DashboardChart'), { ssr: false });

export default function Dashboard() {
  const { spreadsheetId } = useStore();
  const { token } = useAuth();
  const [imports, setImports] = useState<ImportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    if (spreadsheetId && token) {
      setIsLoading(true);
      fetchImportsFromSheet(token, spreadsheetId)
        .then(data => {
          setImports(data);
          const years = Array.from(new Set(data.map(r => r.competencia.split('/')[1]))).filter(Boolean).sort((a, b) => Number(b) - Number(a));
          if (years.length > 0) {
            setSelectedYear(years[0]);
          }
        })
        .catch((err: any) => {
          console.error(err);
          if (err.message === 'TOKEN_EXPIRED') {
            alert("Sua sessão do Google expirou por segurança. Por favor, clique em 'Sair' no menu e faça login novamente.");
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setImports([]);
      setIsLoading(false);
    }
  }, [spreadsheetId, token]);

  const availableYears = useMemo(() => {
    const years = imports.map(r => r.competencia.split('/')[1]).filter(Boolean);
    return Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));
  }, [imports]);

  const filteredImports = useMemo(() => {
    if (!selectedYear) return imports;
    return imports.filter(r => r.competencia.endsWith(`/${selectedYear}`));
  }, [imports, selectedYear]);

  const sortedImports = [...filteredImports].sort((a, b) => {
    const parseDateStr = (dateStr: string) => {
      const parts = dateStr.split('/');
      if (parts.length === 2) {
        return new Date(Number(parts[1]), Number(parts[0]) - 1, 1).getTime();
      }
      return 0;
    };
    return parseDateStr(a.competencia) - parseDateStr(b.competencia);
  });
  
  const chartData = sortedImports.map(r => ({
    name: r.competencia,
    esperado: r.expectedTotal,
    recebido: r.receivedTotal,
  }));

  const totalRecebidoAno = filteredImports.reduce((acc, curr) => acc + curr.receivedTotal, 0);
  const totalFFAno = filteredImports.reduce((acc, curr) => acc + (curr.totalFF || 0), 0);
  const totalFPAno = filteredImports.reduce((acc, curr) => acc + (curr.totalFP || 0), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const sortedAllImports = [...imports].sort((a, b) => new Date(a.importDate).getTime() - new Date(b.importDate).getTime());
  const lastReport = sortedAllImports[sortedAllImports.length - 1];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
          <p className="text-slate-500">Acompanhamento de reconciliação bancária do Comprev.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 w-full sm:w-auto">
          <div className="flex flex-col w-full sm:w-auto">
            <label className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Ano</label>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-700 w-full sm:min-w-[120px]"
            >
              <option value="">Todos</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <Link 
            href="/pagamentos" 
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto text-center whitespace-nowrap"
          >
            Nova Importação
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500 mb-1 leading-tight">Total Recebido no Ano</p>
            <p className="text-[clamp(0.75rem,1.5vw,1.5rem)] font-bold text-emerald-600 whitespace-nowrap">{isLoading ? '-' : formatCurrency(totalRecebidoAno)}</p>
          </div>
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 ml-3">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500 mb-1 leading-tight">Fundo Financeiro</p>
            <p className="text-[clamp(0.75rem,1.5vw,1.5rem)] font-bold text-indigo-600 whitespace-nowrap">{isLoading ? '-' : formatCurrency(totalFFAno)}</p>
          </div>
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 ml-3">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500 mb-1 leading-tight">Fundo Previdenciário</p>
            <p className="text-[clamp(0.75rem,1.5vw,1.5rem)] font-bold text-sky-600 whitespace-nowrap">{isLoading ? '-' : formatCurrency(totalFPAno)}</p>
          </div>
          <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center shrink-0 ml-3">
            <PiggyBank className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500 mb-1 leading-tight">Relatórios no Ano</p>
            <p className="text-[clamp(0.75rem,1.5vw,1.5rem)] font-bold text-slate-900 whitespace-nowrap">{isLoading ? '-' : filteredImports.length}</p>
          </div>
          <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center shrink-0 ml-3">
            <FileBox className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Chart / Table Toggle Section */}
        <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Evolução das Reconciliações {selectedYear && `(${selectedYear})`}
            </h3>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('chart')}
                className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${viewMode === 'chart' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="Gráfico"
              >
                <BarChart2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${viewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="Tabela"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex-1 min-h-[18rem] w-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="flex-1 min-h-[18rem] w-full">
              {viewMode === 'chart' ? (
                <DashboardChart data={chartData} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg">Competência</th>
                        <th className="px-4 py-3 text-right">Esperado</th>
                        <th className="px-4 py-3 text-right">Recebido</th>
                        <th className="px-4 py-3 text-right rounded-tr-lg">Diferença</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedImports.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{item.competencia}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.expectedTotal)}</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(item.receivedTotal)}</td>
                          <td className="px-4 py-3 text-right">
                            {Math.abs(item.expectedTotal - item.receivedTotal) > 0.01 ? (
                              <span className={item.expectedTotal > item.receivedTotal ? "text-amber-600 font-medium" : "text-blue-600 font-medium"}>
                                {item.expectedTotal > item.receivedTotal ? '-' : '+'}{formatCurrency(Math.abs(item.expectedTotal - item.receivedTotal))}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-[18rem] w-full flex flex-col items-center justify-center text-slate-400">
              <FileText className="w-12 h-12 mb-3 text-slate-300" />
              <p>Nenhum dado importado para o período.</p>
            </div>
          )}
        </div>

        {/* Latest Report */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col w-full xl:w-[380px] shrink-0">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg">Última Reconciliação</h3>
          </div>
          
          {isLoading ? (
             <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-3" />
             </div>
          ) : lastReport ? (
            <div className="p-6 flex-1 flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Data da Importação</p>
                <p className="text-slate-900 font-medium text-lg">
                  {lastReport.importDate}
                </p>
                <p className="text-sm text-slate-500 mt-1 flex flex-col">
                  Competência: {lastReport.competencia}
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-lg min-w-0">
                  <p className="text-xs font-medium text-slate-500 mb-1 leading-tight">Total Esperado</p>
                  <p className="font-bold text-slate-900 text-[clamp(0.75rem,1.2vw,1.125rem)] whitespace-nowrap">{formatCurrency(lastReport.expectedTotal)}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg min-w-0">
                  <p className="text-xs font-medium text-emerald-800 mb-1 leading-tight">Valor Recebido</p>
                  <p className="font-bold text-emerald-700 text-[clamp(0.75rem,1.2vw,1.125rem)] whitespace-nowrap">{formatCurrency(lastReport.receivedTotal)}</p>
                </div>
              </div>

              {Math.abs(lastReport.expectedTotal - lastReport.receivedTotal) >= 0.01 && (
                <div className="bg-red-50 p-4 rounded-lg mb-6 border border-red-100">
                  <p className="text-xs font-medium text-red-800 mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Diferença Encontrada
                  </p>
                  <p className="font-bold text-red-700">{formatCurrency(Math.abs(lastReport.expectedTotal - lastReport.receivedTotal))}</p>
                </div>
              )}

              <div className="mt-auto">
                <Link 
                  href={`/relatorios/${lastReport.id}`}
                  className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-200"
                >
                  Ver Relatório Completo
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
              <FileBox className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-slate-500 text-sm mb-4">Você ainda não realizou nenhuma importação de fluxos.</p>
              <Link 
                href="/pagamentos" 
                className="text-blue-600 font-medium hover:underline text-sm"
              >
                Faça sua primeira importação
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
