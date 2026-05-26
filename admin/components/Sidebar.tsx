'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-client';

const NAV = [
  {
    section: 'Principal',
    items: [
      { href: '/',     label: 'Dashboard',        icon: '▦' },
      { href: '/fila', label: 'Fila de Trabalho', icon: '🔔', badge: true },
    ],
  },
  {
    section: 'Salas',
    items: [
      { href: '/salas',    label: 'Mapa do Dia',  icon: '🏢' },
      { href: '/historico',label: 'Histórico',    icon: '📅' },
    ],
  },
  {
    section: 'Médicos',
    items: [
      { href: '/medicos', label: 'Cadastros', icon: '👥' },
      { href: '/planos',  label: 'Planos',    icon: '📋' },
      { href: '/modulos', label: 'Módulos',   icon: '🧩' },
      { href: '/horas',   label: 'Horas',     icon: '⏱'  },
    ],
  },
  {
    section: 'Financeiro',
    items: [
      { href: '/pagamentos', label: 'Pagamentos', icon: '💳' },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { href: '/usuarios', label: 'Usuários', icon: '⚙️' },
    ],
  },
];

interface Props {
  unreadCount: number;
  userEmail:   string;
}

export default function Sidebar({ unreadCount, userEmail }: Props) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
  }

  const initial = userEmail?.[0]?.toUpperCase() ?? 'A';

  return (
    <aside className="flex flex-col w-60 min-w-[240px] bg-oli-sidebar h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-6 border-b border-white/10">
        <div className="w-9 h-9 rounded-full bg-oli-green flex items-center justify-center text-white font-bold text-sm">
          OLI
        </div>
        <div>
          <p className="text-white text-sm font-bold leading-tight">OLI Health Hub</p>
          <p className="text-white/40 text-[10px] uppercase tracking-widest">Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest px-3 pt-4 pb-1.5">
              {section}
            </p>
            {items.map(({ href, label, icon, badge }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${active
                      ? 'bg-oli-green text-white'
                      : 'text-white/55 hover:bg-white/5 hover:text-white/85'}`}
                >
                  <span className="text-base w-4 text-center leading-none">{icon}</span>
                  <span className="flex-1">{label}</span>
                  {badge && unreadCount > 0 && (
                    <span className="bg-oli-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2.5 px-4 py-4 border-t border-white/10 hover:bg-white/5 transition-colors w-full"
      >
        <div className="w-7 h-7 rounded-full bg-oli-green flex items-center justify-center text-white text-xs font-bold">
          {initial}
        </div>
        <span className="text-white/50 text-xs truncate">{userEmail}</span>
      </button>
    </aside>
  );
}
