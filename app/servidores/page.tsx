'use client';
import { useState, useEffect } from 'react';
import { useStore, Server } from '@/lib/store';
import { Plus, Search, Edit2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/components/AuthProvider';
import { fetchServersFromSheet, appendServerToSheet, batchAppendServersToSheet, updateServerInSheet } from '@/lib/sheets';
import { v4 as uuidv4 } from 'uuid';

export default function ServidoresPage() {
  const { updateServer, addServer, calculateFund, spreadsheetId } = useStore();
  const { token } = useAuth();
  
  const [sheetServers, setSheetServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<Server>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Volta pra página 1 sempre que buscar
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadFromSheet = async () => {
    if (!token || !spreadsheetId) return;
    setIsLoading(true);
    try {
      const data = await fetchServersFromSheet(token, spreadsheetId);
      setSheetServers(data);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'TOKEN_EXPIRED') {
        alert("Sua sessão do Google expirou por segurança. Por favor, clique em 'Sair' no menu e faça login novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (spreadsheetId && token) {
      loadFromSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadsheetId, token]);

  const displayServers = sheetServers;

  const filteredServers = displayServers.filter(s => 
    s.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
    s.cpf.includes(debouncedSearchTerm)
  );

  const totalPages = Math.max(1, Math.ceil(filteredServers.length / itemsPerPage));
  const paginatedServers = filteredServers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleEdit = (server: Server) => {
    setEditingServer(server);
    setFormData(server);
    setIsAdding(false);
  };

  const handleAddNew = () => {
    setEditingServer(null);
    setIsAdding(true);
    setFormData({ origin: 'RGPS', status: 'APPROVED', fund: 'FUNDO_PREVIDENCIARIO' });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.cpf) {
      alert('Por favor, preencha Nome e CPF.');
      return;
    }
    
    setIsSaving(true);
    try {
      if (isAdding) {
        if (spreadsheetId && token) {
          const newServer = { ...formData, id: uuidv4() } as Server;
          await appendServerToSheet(token, spreadsheetId, newServer);
          setSheetServers([...sheetServers, newServer]);
        } else {
          alert('Por favor, conecte a planilha nas configurações antes de adicionar novos servidores.');
        }
      } else if (editingServer) {
        if (spreadsheetId && token) {
          const index = parseInt(editingServer.id.split('-')[1]);
          if (!isNaN(index)) {
            const rowIndex = index + 1; // 1-based no Google Sheets
            const updatedServer = { ...formData, id: editingServer.id, status: 'APPROVED' } as Server;
            await updateServerInSheet(token, spreadsheetId, rowIndex, updatedServer);
            
            // Atualiza a lista na tela sem recarregar tudo
            setSheetServers(prev => prev.map(s => s.id === editingServer.id ? updatedServer : s));
          } else {
            alert('Não foi possível identificar a linha deste servidor na planilha.');
          }
        } else {
          alert('Por favor, conecte a planilha nas configurações.');
        }
      }
      
      setEditingServer(null);
      setIsAdding(false);
      setFormData({});
    } catch (err) {
      alert('Erro ao salvar servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Servidores</h1>
          <p className="text-slate-500">Gerencie os cadastros para compensação previdenciária.</p>
        </div>
        <div className="flex items-center gap-3">
          {spreadsheetId && token && (
            <button 
              onClick={loadFromSheet}
              disabled={isLoading}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx("w-4 h-4", isLoading && "animate-spin")} />
              Sincronizar
            </button>
          )}
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Servidor
          </button>
        </div>
      </div>

      {(editingServer || isAdding) && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm mb-8 ring-1 ring-blue-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {isAdding ? 'Cadastrar Novo Servidor' : 'Completar / Editar Cadastro'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
              <input
                type="text"
                value={(formData.cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setFormData({ ...formData, cpf: val });
                }}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Ingresso no Regime</label>
              <input
                type="text"
                value={formData.entryDate || ''}
                placeholder="DD/MM/AAAA"
                onChange={e => {
                  let val = e.target.value.replace(/\D/g, '').slice(0, 8);
                  if (val.length >= 5) {
                    val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
                  } else if (val.length >= 3) {
                    val = `${val.slice(0, 2)}/${val.slice(2)}`;
                  }
                  
                  setFormData({ 
                    ...formData, 
                    entryDate: val, 
                    fund: val.length === 10 ? calculateFund(val) : formData.fund 
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Origem do Recurso</label>
              <select
                value={formData.origin || 'RGPS'}
                onChange={e => setFormData({ ...formData, origin: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="RGPS">RGPS (INSS)</option>
                <option value="RPPS">Outro RPPS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fundo de Segregação</label>
              <select
                value={formData.fund || 'NAO_DEFINIDO'}
                onChange={e => setFormData({ ...formData, fund: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="FUNDO_FINANCEIRO">Fundo Financeiro</option>
                <option value="FUNDO_PREVIDENCIARIO">Fundo Previdenciário</option>
                <option value="NAO_DEFINIDO">Não Definido</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Salvar e Aprovar'}
            </button>
            <button
              onClick={() => {
                setEditingServer(null);
                setIsAdding(false);
              }}
              className="bg-white text-slate-700 px-4 py-2 rounded-md border border-slate-300 font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold sticky top-0 shadow-sm">
              <tr>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Nome / CPF</th>
                <th className="px-6 py-3">Ingresso</th>
                <th className="px-6 py-3">Origem</th>
                <th className="px-6 py-3">Fundo (Segregação)</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedServers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhum servidor encontrado.
                  </td>
                </tr>
              ) : (
                paginatedServers.map((server) => (
                  <tr key={server.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      {server.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5" /> Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{server.name}</p>
                      <p className="text-slate-500 text-xs">
                        {server.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {server.entryDate || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                        {server.origin}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "text-xs font-medium",
                        server.fund === 'FUNDO_FINANCEIRO' ? "text-indigo-600" :
                        server.fund === 'FUNDO_PREVIDENCIARIO' ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {server.fund.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(server)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-md transition-colors inline-flex items-center gap-2 text-xs font-medium"
                      >
                        {server.status === 'PENDING' ? 'Completar' : 'Editar'}
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Paginação */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="text-sm text-slate-600">
              Mostrando página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{totalPages}</span> 
              {' '} ({filteredServers.length} resultados)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
