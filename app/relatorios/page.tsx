'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/lib/store';
import { fetchImportsFromSheet, ImportSummary } from '@/lib/sheets';
import { ArrowRight, FileText, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function RelatoriosPage() {
  const { token } = useAuth();
  const { spreadsheetId } = useStore();
  const [imports, setImports] = useState<ImportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (token && spreadsheetId) {
      fetchImportsFromSheet(token, spreadsheetId)
        .then(data => {
          setImports(data);
        })
        .catch(err => {
          console.error("Falha ao buscar importações:", err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [token, spreadsheetId]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const filteredReports = imports
    .filter(r => r.competencia.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios de Reconciliação</h1>
          <p className="text-slate-500">Histórico de importações (lidos da aba Pagamentos).</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar por competência..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="py-3 px-6 font-medium">Data da Importação</th>
                <th className="py-3 px-6 font-medium">Competência</th>
                <th className="py-3 px-6 font-medium text-right">Líquido Esperado</th>
                <th className="py-3 px-6 font-medium text-right">Valor Recebido</th>
                <th className="py-3 px-6 font-medium text-right">Diferença</th>
                <th className="py-3 px-6 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                    <p>Carregando relatórios da planilha...</p>
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p>Nenhum relatório encontrado na planilha.</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 text-slate-900">
                      {report.importDate}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-900">
                      {report.competencia}
                    </td>
                    <td className="py-4 px-6 text-right font-medium text-slate-900">
                      {formatCurrency(report.expectedTotal)}
                    </td>
                    <td className="py-4 px-6 text-right font-medium text-emerald-600">
                      {formatCurrency(report.receivedTotal)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${Math.abs(report.expectedTotal - report.receivedTotal) < 0.01 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {formatCurrency(Math.abs(report.expectedTotal - report.receivedTotal))}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <Link 
                        href={`/relatorios/${report.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Ver Detalhes
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

