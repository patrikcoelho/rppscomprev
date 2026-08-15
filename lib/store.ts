import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { parseISO, isBefore, isEqual } from 'date-fns';

export type Origin = 'RGPS' | 'RPPS';
export type Fund = 'FUNDO_FINANCEIRO' | 'FUNDO_PREVIDENCIARIO' | 'NAO_DEFINIDO';
export type Status = 'PENDING' | 'APPROVED';

export interface Server {
  id: string;
  cpf: string;
  name: string;
  entryDate?: string;
  origin: Origin;
  status: Status;
  fund: Fund;
}

export interface ReportServer {
  cpf: string;
  name: string;
  entryDate?: string;
  fund: Fund;
  receber: number;
  pagar: number;
  glosa: number;
  value: number;
  destinatario?: string;
  observacao?: string;
  juros?: number;
}

export interface ReconciliationReport {
  id: string;
  date: string;
  competencia: string;
  expectedReceber: number;
  expectedPagar: number;
  expectedGlosas: number;
  expectedTotal: number;
  receivedTotal: number;
  difference: number;
  fundsTotal: Record<Fund, number>;
  paymentDate?: string;
  receivedByInstitution?: Record<string, number>;
  fileNames: {
    receber: string;
    pagar?: string;
    glosas?: string;
  };
  servers: ReportServer[];
}

interface AppState {
  spreadsheetId: string | null;
  setSpreadsheetId: (id: string) => void;
  servers: Server[];
  reports: ReconciliationReport[];
  addServer: (server: Omit<Server, 'id'>) => void;
  updateServer: (id: string, server: Partial<Server>) => void;
  deleteServer: (id: string) => void;
  upsertServersFromImport: (serversToImport: Omit<Server, 'id' | 'fund' | 'status'>[]) => void;
  addReport: (report: Omit<ReconciliationReport, 'id'>) => void;
  calculateFund: (entryDate?: string) => Fund;
  setServers: (servers: Server[]) => void;
  confrontoData: Record<string, string>;
  setConfrontoStatus: (cpf: string, status: string) => void;
}

const CUTOFF_DATE = new Date('2005-01-18T00:00:00Z');

// Removido o middleware "persist" para NÃO usar localStorage.
// O ID da planilha agora vem por padrão da variável de ambiente da Vercel.
export const useStore = create<AppState>()((set, get) => ({
  spreadsheetId: process.env.NEXT_PUBLIC_SPREADSHEET_ID || null,
  setSpreadsheetId: (id) => set({ spreadsheetId: id }),
  servers: [],
  reports: [],
  confrontoData: {},
  setConfrontoStatus: (cpf, status) => set((state) => ({
    confrontoData: {
      ...state.confrontoData,
      [cpf]: status
    }
  })),
  
  calculateFund: (dateStr?: string): Fund => {
    if (!dateStr) return 'NAO_DEFINIDO';
    
    let date;
    if (dateStr.includes('/')) {
      const [dd, mm, yyyy] = dateStr.split('/');
      date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    } else {
      date = new Date(`${dateStr}T00:00:00Z`);
    }
    
    if (isNaN(date.getTime())) return 'NAO_DEFINIDO';

    const cutoff = new Date(2003, 11, 31);
    return date <= cutoff ? 'FUNDO_FINANCEIRO' : 'FUNDO_PREVIDENCIARIO';
  },

  addServer: (serverData) => {
    const id = uuidv4();
    const fund = get().calculateFund(serverData.entryDate);
    set((state) => ({
      servers: [...state.servers, { ...serverData, id, fund, status: serverData.status || 'APPROVED' }],
    }));
  },

  updateServer: (id, serverData) => {
    set((state) => ({
      servers: state.servers.map((server) => {
        if (server.id === id) {
          const updatedServer = { ...server, ...serverData };
          if (serverData.entryDate !== undefined) {
            updatedServer.fund = get().calculateFund(updatedServer.entryDate);
          }
          return updatedServer;
        }
        return server;
      }),
    }));
  },

  deleteServer: (id) => {
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
    }));
  },

  upsertServersFromImport: (serversToImport) => {
    set((state) => {
      const newServers = [...state.servers];
      let changed = false;
      
      serversToImport.forEach(importedServer => {
        const existing = newServers.find(s => s.cpf === importedServer.cpf);
        if (!existing && importedServer.cpf !== '00000000000') {
          newServers.push({
            ...importedServer,
            id: uuidv4(),
            status: 'PENDING',
            fund: 'NAO_DEFINIDO'
          });
          changed = true;
        }
      });

      return changed ? { servers: newServers } : state;
    });
  },

  addReport: (reportData) => {
    const id = uuidv4();
    set((state) => ({
      reports: [{ ...reportData, id }, ...state.reports],
    }));
  },
  
  setServers: (newServers) => {
    set({ servers: newServers });
  }
}));

