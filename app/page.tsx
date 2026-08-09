'use client';

import { useStore } from '@/lib/store';
import { 
  Users, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  TrendingUp,
  FileBox,
  ArrowRight,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';

const DashboardChart = dynamic(() => import('@/components/DashboardChart'), { ssr: false });
import { fetchServersFromSheet, fetchImportsFromSheet, ImportSummary } from '@/lib/sheets';
import { useState, useEffect } from 'react';
import { Server } from '@/lib/store';

export default function Dashboard() {
  const { spreadsheetId } = useStore();
  const { token } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [imports, setImports] = useState<ImportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (spreadsheetId && token) {
      setIsLoading(true);
      Promise.all([
        fetchServersFromSheet(token, spreadsheetId).then(data => setServers(data)),
        fetchImportsFromSheet(token, spreadsheetId).then(data => setImports(data))
      ])
        .catch((err: any) => {
          console.error(err);
          if (err.message === 'TOKEN_EXPIRED') {
            alert("Sua sessão do Google expirou por segurança. Por favor, clique em 'Sair' no menu e faça login novamente.");
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setServers([]);
      setImports([]);
      setIsLoading(false);
    }
  }, [spreadsheetId, token]);

  const totalServers = servers.length;
  const pendingServers = servers.filter(s => s.status === 'PENDING').length;
  const activeServers = servers.filter(s => s.status === 'APPROVED').length;

  const sortedImports = [...imports].sort((a, b) => new Date(a.importDate).getTime() - new Date(b.importDate).getTime());
  
  const chartData = sortedImports.map(r => ({
    name: r.competencia,
    esperado: r.expectedTotal,
    recebido: r.receivedTotal,
  }));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const lastReport = sortedImports[sortedImports.length - 1];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
          <p className="text-slate-500">Acompanhamento de reconciliação bancária do Comprev.</p>
        </div>
        <Link 
          href="/importar" 
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          Nova Importação
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total de Servidores</p>
            <p className="text-3xl font-bold text-slate-900">{isLoading ? '-' : totalServers}</p>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Pendentes de Cadastro</p>
            <p className="text-3xl font-bold text-amber-600">{isLoading ? '-' : pendingServers}</p>
          </div>
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Servidores Ativos</p>
            <p className="text-3xl font-bold text-emerald-600">{isLoading ? '-' : activeServers}</p>
          </div>
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total de Relatórios</p>
            <p className="text-3xl font-bold text-indigo-600">{isLoading ? '-' : imports.length}</p>
          </div>
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <FileBox className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Evolução das Reconciliações
            </h3>
          </div>
          
          {isLoading ? (
            <div className="h-72 w-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-72 w-full">
              <DashboardChart data={chartData} />
            </div>
          ) : (
            <div className="h-72 w-full flex flex-col items-center justify-center text-slate-400">
              <FileText className="w-12 h-12 mb-3 text-slate-300" />
              <p>Nenhum dado importado ainda.</p>
            </div>
          )}
        </div>

        {/* Latest Report */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
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
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-slate-500 mb-1">Total Esperado</p>
                  <p className="font-bold text-slate-900">{formatCurrency(lastReport.expectedTotal)}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-emerald-800 mb-1">Valor Recebido</p>
                  <p className="font-bold text-emerald-700">{formatCurrency(lastReport.receivedTotal)}</p>
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
                href="/importar" 
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
