import type {Metadata} from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'RPPS-Comprev',
  description: 'Sistema de gestão e reconciliação financeira para compensação previdenciária',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className="bg-slate-50 text-slate-900 font-sans antialiased flex min-h-screen">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 flex flex-col h-screen overflow-y-auto">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
