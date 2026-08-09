'use client';

import { useStore, Fund, ReportServer, Server } from '@/lib/store';
import { ArrowLeft, Printer, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchServersFromSheet, parseSheetDate } from '@/lib/sheets';

function FundTable({ 
  title, 
  competencia,
  servers, 
  paymentDate,
  footerLabel
}: { 
  title: string;
  competencia: string;
  servers: any[];
  paymentDate?: string;
  footerLabel?: string;
}) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };
  
  const hasObservacao = servers.some(s => s.observacao && s.observacao.trim() !== '');
  
  const totalReceber = servers.reduce((acc, curr) => acc + (curr.receber || 0), 0);
  const totalPagar = servers.reduce((acc, curr) => acc + (curr.pagar || 0), 0);
  const totalGlosa = servers.reduce((acc, curr) => acc + (curr.glosa || 0), 0);
  const totalValue = servers.reduce((acc, curr) => acc + (curr.value || 0), 0);

  return (
    <div className="mb-12 print:mb-8 overflow-x-auto">
      <div className="mb-2 font-bold text-slate-800">{title}</div>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
            <th className="py-2 px-3 font-semibold border border-slate-300 uppercase">SERVIDOR</th>
            <th className="py-2 px-3 font-semibold border border-slate-300 uppercase text-center">COMPETÊNCIA</th>
            <th className="py-2 px-3 font-semibold border border-slate-300 uppercase text-right">A RECEBER</th>
            <th className="py-2 px-3 font-semibold border border-slate-300 uppercase text-right">A PAGAR</th>
            <th className="py-2 px-3 font-semibold border border-slate-300 uppercase text-right">GLOSAS</th>
            <th className="py-2 px-3 font-semibold border border-slate-300 uppercase text-right text-blue-800">LÍQUIDO</th>
            <th className="py-2 px-3 font-semibold border border-slate-300 uppercase text-center">DATA PGTO</th>
            <th className="py-2 px-3 font-semibold border border-slate-300 uppercase text-center">FUNDO</th>
            {hasObservacao && <th className="py-2 px-3 font-semibold border border-slate-300 uppercase">OBSERVAÇÃO</th>}
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={hasObservacao ? 9 : 8} className="py-8 text-center text-slate-500 bg-white border border-slate-300">
                Nenhum servidor encontrado neste fundo
              </td>
            </tr>
          ) : (
            servers.map((server, idx) => (
              <tr key={idx} className="border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                <td className="py-1.5 px-3 border border-slate-300 text-slate-900 font-medium">
                  {server.name} - {String(server.cpf).padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')} - {(!title || title.toUpperCase().includes('RGPS') || title.toUpperCase().includes('INSS') || title.includes('NÃO INFORMADO') || title === 'NAO_INFORMADO') ? 'RGPS' : `RPPS ${title}`}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-center text-slate-700 whitespace-nowrap">
                  {competencia}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right text-slate-900 whitespace-nowrap">
                  {formatCurrency(server.receber || 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right text-red-700 whitespace-nowrap">
                  {formatCurrency(server.pagar || 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right text-red-700 whitespace-nowrap">
                  {formatCurrency(server.glosa || 0)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-right text-blue-900 whitespace-nowrap font-bold">
                  {formatCurrency(server.value)}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-center text-slate-700 whitespace-nowrap">
                  {paymentDate || '-'}
                </td>
                <td className="py-1.5 px-3 border border-slate-300 text-center text-slate-700 font-bold whitespace-nowrap">
                  {server.fund === 'FUNDO_FINANCEIRO' ? 'FF' : server.fund === 'FUNDO_PREVIDENCIARIO' ? 'FP' : '-'}
                </td>
                {hasObservacao && (
                  <td className="py-1.5 px-3 border border-slate-300 text-slate-600 text-[11px] max-w-xs truncate" title={server.observacao}>
                    {server.observacao || '-'}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
        <tfoot className="bg-slate-100 font-bold">
          <tr>
            <td colSpan={2} className="py-2 px-3 border border-slate-300 text-right text-slate-700">{footerLabel || 'TOTAIS:'}</td>
            <td className="py-2 px-3 border border-slate-300 text-right text-slate-900">{formatCurrency(totalReceber)}</td>
            <td className="py-2 px-3 border border-slate-300 text-right text-red-700">{formatCurrency(totalPagar)}</td>
            <td className="py-2 px-3 border border-slate-300 text-right text-red-700">{formatCurrency(totalGlosa)}</td>
            <td className="py-2 px-3 border border-slate-300 text-right text-blue-900">{formatCurrency(totalValue)}</td>
            <td colSpan={hasObservacao ? 3 : 2} className="py-2 px-3 border border-slate-300 bg-slate-100"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function RelatorioDetalhesPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { spreadsheetId } = useStore();
  const { token } = useAuth();
  
  const [report, setReport] = useState<any>(null);
  const [sheetServers, setSheetServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (spreadsheetId && token) {
      setIsLoading(true);
      import('@/lib/sheets').then(({ fetchServersFromSheet, fetchImportDetailsFromSheet }) => {
        Promise.all([
          fetchServersFromSheet(token, spreadsheetId).then(setSheetServers),
          fetchImportDetailsFromSheet(token, spreadsheetId, unwrappedParams.id).then(setReport)
        ])
          .catch((err: any) => {
            console.error(err);
            if (err.message === 'TOKEN_EXPIRED') {
              alert("Sua sessão do Google expirou por segurança. Por favor, clique em 'Sair' no menu e faça login novamente.");
            }
          })
          .finally(() => setIsLoading(false));
      });
    } else {
      setIsLoading(false);
    }
  }, [spreadsheetId, token, unwrappedParams.id]);

  if (!isLoading && !report) {
    return notFound();
  }

  const normalizeCpf = (c: string | number) => String(c).replace(/\D/g, '').padStart(11, '0');

  // Mapeamento dinâmico: sobreescreve APENAS nome e fundo com a base atualizada
  const mappedServers = (report?.servers || []).map((s: any) => {
    const latest = sheetServers.find(fresh => normalizeCpf(fresh.cpf) === normalizeCpf(s.cpf));
    return {
      ...s,
      name: latest && latest.name !== 'Servidor a Identificar' ? latest.name : s.name,
      fund: latest ? latest.fund : s.fund,
      entryDate: latest && latest.entryDate ? latest.entryDate : '',
    };
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const groups: Record<string, any[]> = {};
  
  mappedServers.forEach((s: any) => {
    let dest = s.destinatario && s.destinatario !== 'NAO_INFORMADO' ? s.destinatario : 'DESTINATÁRIO NÃO INFORMADO';
    
    // Se não tem destinatário informado, mas o servidor é do RGPS, agrupa no RGPS
    if (dest === 'DESTINATÁRIO NÃO INFORMADO' && s.origin === 'RGPS') {
      dest = 'RGPS';
    }

    if (!groups[dest]) groups[dest] = [];
    groups[dest].push(s);
  });

  return (
    <div className="p-8 max-w-7xl mx-auto w-full print:p-0">
      <div className="mb-8 flex items-center justify-between print:hidden">
        <div>
          <Link href="/relatorios" className="inline-flex items-center gap-2 text-blue-600 hover:underline mb-2 font-medium text-sm">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Relatórios
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-slate-500" />
            Relatório de Reconciliação
          </h1>
          <p className="text-slate-500 text-sm mt-1">Data: {report?.importDate}</p>
        </div>
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-900 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8 print:hidden">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Competência</p>
          <p className="text-xl font-bold text-slate-900">{report?.competencia}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Data Pagamento</p>
          <p className="text-xl font-bold text-slate-900">
            {report?.paymentDate || '-'}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Líquido Esperado</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(report?.expectedTotal || 0)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm bg-emerald-50 border-emerald-200">
          <p className="text-sm font-medium text-emerald-800 mb-1">Recebido na Conta</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(report?.receivedTotal || 0)}</p>
          {report && Math.abs(report.difference) > 0.01 && (
            <p className="text-xs text-red-600 mt-1 font-medium">Diferença: {formatCurrency(report.difference)}</p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Buscando dados na planilha do Google...</p>
        </div>
      ) : (
        <div className="bg-white print:bg-transparent p-8 print:p-0 rounded-xl border border-slate-200 print:border-none shadow-sm print:shadow-none">
          {Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])).map(([dest, serversGroup]) => (
            <FundTable
              key={dest}
              title={dest}
              competencia={report.competencia}
              servers={serversGroup}
              paymentDate={report.paymentDate}
              footerLabel="TOTAL DO DESTINATÁRIO:"
            />
          ))}
        </div>
      )}
    </div>
  );
}
