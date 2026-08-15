'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';

export default function ConfigPage() {
  const { spreadsheetId, setSpreadsheetId } = useStore();
  const [inputValue, setInputValue] = useState(spreadsheetId || '');
  const { token } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

  const handleSave = () => {
    let id = inputValue.trim();
    if (id.includes('/d/')) {
      const match = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        id = match[1];
      }
    }
    setSpreadsheetId(id);
    alert('Configuração salva com sucesso!');
  };

  const handleCreateNew = async () => {
    if (!token) {
      alert('Você precisa estar logado para criar uma planilha.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: 'RPPS-Comprev Dados'
          },
          sheets: [
            { properties: { title: 'Servidores' } },
            { properties: { title: 'Pagamentos' } },
            { properties: { title: 'Confronto' } }
          ]
        })
      });
      const data = await res.json();
      if (data.spreadsheetId) {
        setSpreadsheetId(data.spreadsheetId);
        setInputValue(data.spreadsheetId);
        alert('Planilha criada com sucesso!');
      } else {
        alert('Erro ao criar planilha.');
        console.error(data);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao criar planilha.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Configurações</h1>
      <p className="text-slate-500 mb-8">Gerencie as integrações e configurações do sistema.</p>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Integração com Google Sheets</h2>
        <p className="text-sm text-slate-600 mb-4">
          Defina a planilha do Google Sheets que será usada para armazenar a lista de servidores e relatórios de pagamentos.
        </p>
        
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID ou Link da Planilha</label>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Ex: 1BxiMVs0XRYFgCEKU..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700">
              Salvar Configuração
            </button>
            <button 
              onClick={handleCreateNew} 
              disabled={isCreating}
              className="bg-white text-emerald-700 px-4 py-2 rounded-md border border-emerald-300 font-medium hover:bg-emerald-50 disabled:opacity-50"
            >
              {isCreating ? 'Criando...' : 'Criar Nova Planilha Automaticamente'}
            </button>
          </div>
        </div>
        
        {spreadsheetId && (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-sm text-slate-600">
              Planilha atual configurada:{' '}
              <a 
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 font-medium hover:underline"
              >
                Abrir no Google Sheets &rarr;
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
