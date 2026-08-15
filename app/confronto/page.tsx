'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';
import { fetchSheetData } from '@/lib/sheets';
import { AlertCircle, CheckCircle2, Search, Loader2 } from 'lucide-react';

interface RowData {
  [key: string]: any;
}

interface ConfrontoItem {
  cpf: string;
  name: string;
  origem: string;
  status: string;
}

const STATUS_OPTIONS = [
  'Não Realizado',
  'Em Análise',
  'Requerimento Enviado',
  'Aguardando Documentação',
  'Concluído'
];

export default function ConfrontoPage() {
  const { spreadsheetId, confrontoData, setConfrontoStatus } = useStore();
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
        const [censo, aposentadorias, averbacoes, listaComprev] = await Promise.all([
          fetchSheetData(token, spreadsheetId, 'Censo'),
          fetchSheetData(token, spreadsheetId, 'Aposentadorias'),
          fetchSheetData(token, spreadsheetId, 'Averbacoes'),
          fetchSheetData(token, spreadsheetId, 'Lista_comprev')
        ]);
        
        const cleanCpf = (str: any) => (str ? String(str).replace(/[^\d]/g, '') : '');
        // Adiciona as possibilidades de coluna com base nas respostas e arquivos
        const getCpf = (row: RowData) => cleanCpf(row['CPF'] || row['CPF Beneficiário'] || row['CPF_INSTITUIDOR'] || row['CPF_BENEFICIARIO'] || '');
        const getName = (row: RowData) => String(row['NOME_BENEFICIARIO'] || row['Nome Beneficiário'] || row['NOME'] || row['NOME_INSTITUIDOR'] || row['Nome'] || 'Desconhecido');

        const inativosMap = new Map<string, string>(); // CPF -> Name
        
        // 1. Inativos do Censo (Tudo que não é EFETIVO)
        censo.forEach(row => {
          const cat = String(row['CATEGORIA_INSTITUIDOR'] || row['CATEGORIA'] || '').toUpperCase();
          const cpf = getCpf(row);
          if (cpf && cat && cat !== 'EFETIVO') {
            inativosMap.set(cpf, getName(row));
          }
        });

        // 2. Aposentadorias (Todos são inativos)
        aposentadorias.forEach(row => {
          const cpf = getCpf(row);
          if (cpf) {
            inativosMap.set(cpf, getName(row));
          }
        });

        // 3. Averbações
        const averbadosSet = new Set<string>();
        averbacoes.forEach(row => {
          const cpf = getCpf(row);
          if (cpf) averbadosSet.add(cpf);
        });

        // 4. Lista Comprev (Requerimentos já feitos)
        const requeridosSet = new Set<string>();
        listaComprev.forEach(row => {
          const cpf = getCpf(row);
          if (cpf) requeridosSet.add(cpf);
        });

        // CRUZAMENTO PRINCIPAL: Inativos + Com Averbação + SEM Requerimento
        const resultados: ConfrontoItem[] = [];
        
        inativosMap.forEach((name, cpf) => {
          if (averbadosSet.has(cpf) && !requeridosSet.has(cpf)) {
            resultados.push({
              cpf,
              name,
              origem: 'Censo/Aposentadorias',
              status: confrontoData[cpf] || 'Não Realizado'
            });
          }
        });
        
        setItems(resultados);
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
    setItems(prev => prev.map(item => 
      item.cpf === cpf ? { ...item, status: newStatus } : item
    ));
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
          <p className="text-slate-500">Identifique servidores inativos com averbação pendentes de requerimento.</p>
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
                          <p className="text-xs text-slate-500">Inativo identificado via {item.origem}</p>
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
                            {STATUS_OPTIONS.map(opt => (
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
