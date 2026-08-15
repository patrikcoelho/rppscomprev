'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from '@/lib/auth';
import { verifyUserAccess } from '@/lib/sheets';
import { useStore } from '@/lib/store';

interface AuthContextType {
  user: User | null;
  token: string | null;
  needsAuth: boolean;
  login: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [accessError, setAccessError] = useState<string | null>(null);
  const { spreadsheetId } = useStore();

  useEffect(() => {
    setMounted(true);
    const unsubscribe = initAuth(
      async (u, t) => {
        try {
          if (spreadsheetId && u.email) {
            const hasAccess = await verifyUserAccess(t, spreadsheetId, u.email);
            if (!hasAccess) {
              setAccessError('Acesso Negado: Seu e-mail não está na aba Acessos.');
              await logout();
              setUser(null);
              setToken(null);
              setNeedsAuth(true);
              return;
            }
          }

          setAccessError(null);
          setUser(u);
          setToken(t);
          setNeedsAuth(false);
        } catch (err: any) {
          console.error('Auth initialization failed:', err);
          setAccessError(err?.message === 'TOKEN_EXPIRED'
            ? 'Sua sessão do Google expirou. Faça login novamente.'
            : 'Falha ao validar seu acesso. Faça login novamente.');
          await logout();
          setUser(null);
          setToken(null);
          setNeedsAuth(true);
        } finally {
          setLoading(false);
        }
      },
      async () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const login = async () => {
    setIsLoggingIn(true);
    setAccessError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        if (spreadsheetId && result.user.email) {
          const hasAccess = await verifyUserAccess(result.accessToken, spreadsheetId, result.user.email);
          if (!hasAccess) {
            setAccessError('Acesso Negado: Seu e-mail não está na aba Acessos.');
            await logout();
            setIsLoggingIn(false);
            return;
          }
        }
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setAccessError(err.message === 'TOKEN_EXPIRED' ? 'Sessão expirada. Tente novamente.' : 'Erro ao fazer login.');
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const signOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
  };

  return (
    <AuthContext.Provider value={{ user, token, needsAuth, login, signOut }}>
      {!mounted ? (
        children // SSR renders children normally
      ) : loading ? (
        <div className="flex h-screen items-center justify-center w-full">Carregando...</div>
      ) : needsAuth ? (
        <div className="flex h-screen items-center justify-center bg-slate-50 w-full flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">RPPS-Comprev</h1>
            <p className="text-slate-500">Faça login com sua conta do Google para continuar</p>
          </div>
          {accessError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm max-w-sm text-center border border-red-200">
              {accessError}
            </div>
          )}
          <button onClick={login} disabled={isLoggingIn} className="gsi-material-button bg-white text-slate-700 font-medium px-6 py-3 rounded-lg border border-slate-300 shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-colors">
            {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
          </button>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
