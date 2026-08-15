'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Upload, FileText, Settings, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/components/AuthProvider';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Servidores', href: '/servidores', icon: Users },
  { name: 'Importar CSV', href: '/importar', icon: Upload },
  { name: 'Relatórios', href: '/relatorios', icon: FileText },
  { name: 'Confronto', href: '/confronto', icon: FileText },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <div className="flex flex-col w-64 bg-slate-900 text-white min-h-screen">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white">
          RC
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight text-white">RPPS-Comprev</h1>
          <p className="text-xs text-slate-400">Sistema de Gestão</p>
        </div>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium',
                isActive
                  ? 'bg-blue-600/10 text-blue-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        <button 
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors font-medium mb-4"
        >
          <LogOut className="w-4 h-4" />
          Sair do sistema
        </button>
        <div className="text-center">
          &copy; {new Date().getFullYear()} RPPS-Comprev
        </div>
      </div>
    </div>
  );
}
