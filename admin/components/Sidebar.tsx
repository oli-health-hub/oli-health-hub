'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-client';

// ─── SVG Icons (inline — sem dependência externa) ─────────────────────────────

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="1" />
      <path d="M9 22V12h6v10" />
      <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconPuzzle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconCreditCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 5v3h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconArrowsUpDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <polyline points="17 7 12 2 7 7" />
      <polyline points="17 17 12 22 7 17" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconLogOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconQR() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v3M14 20h3M17 17h4v4" />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17.3l-5.9 3.3 1.4-6.6-5-4.6 6.6-.7z" />
    </svg>
  );
}

// ─── Navegação ────────────────────────────────────────────────────────────────

// Sidebar enxuto: 9 itens em 4 grupos. Páginas consolidadas em /financeiro e /catalogo.
const NAV = [
  {
    section: 'Operação',
    items: [
      { href: '/',          label: 'Dashboard',   Icon: IconDashboard, badge: false },
      { href: '/salas',     label: 'Mapa do Dia', Icon: IconBuilding,  badge: false },
      { href: '/fila',      label: 'Fila',        Icon: IconBell,      badge: true  },
      { href: '/totem',     label: 'Totem QR',    Icon: IconQR,        badge: false },
    ],
  },
  {
    section: 'Clientes',
    items: [
      // Rótulo é "Profissionais" (a base tem nutricionista, psicólogo, dentista —
      // não só médico), mas a rota segue /medicos pra não quebrar link salvo.
      { href: '/medicos',    label: 'Profissionais', Icon: IconUsers,    badge: false },
      { href: '/historico',  label: 'Histórico',  Icon: IconCalendar, badge: false },
      { href: '/comunidade', label: 'Comunidade', Icon: IconChat,     badge: false },
      { href: '/notificacoes', label: 'Notificações', Icon: IconBell, badge: false },
      { href: '/leads',      label: 'Leads',      Icon: IconInbox,    badge: false },
      { href: '/equipe',     label: 'Equipe',     Icon: IconStar,     badge: false },
    ],
  },
  {
    section: 'Financeiro',
    items: [
      { href: '/financeiro', label: 'Financeiro', Icon: IconCreditCard, badge: false },
      { href: '/catalogo',   label: 'Catálogo',   Icon: IconLayers,     badge: false },
      { href: '/cupons',     label: 'Cupons',     Icon: IconCreditCard, badge: false },
      { href: '/parceiros',  label: 'Parceiros',  Icon: IconTruck,      badge: false },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { href: '/usuarios', label: 'Usuários', Icon: IconSettings, badge: false },
    ],
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  unreadCount: number;
  userEmail:   string;
}

const FOUNDER_EMAIL = 'guilherme.pasquetti@gmail.com';

export default function Sidebar({ unreadCount, userEmail }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const isFounder = userEmail === FOUNDER_EMAIL;

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
  }

  const initial = userEmail?.[0]?.toUpperCase() ?? 'A';

  return (
    <aside className="flex flex-col w-60 min-w-[240px] bg-oli-sidebar h-screen sticky top-0">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://xwcarrurjvfxisuaihid.supabase.co/storage/v1/object/public/assets/logo_oli_transparent.png"
            alt="OLI Health Hub"
            className="w-7 h-7 object-contain"
          />
        </div>
        <div>
          <p className="text-white text-sm font-bold leading-tight tracking-tight">OLI Health Hub</p>
          <p className="text-white/35 text-[10px] uppercase tracking-widest font-medium">Painel Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest px-3 pt-4 pb-1.5">
              {section}
            </p>
            {items.map(({ href, label, Icon, badge }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                    ${active
                      ? 'bg-oli-green text-white shadow-sm'
                      : 'text-white/50 hover:bg-white/6 hover:text-white/80'}`}
                >
                  <span className={`shrink-0 ${active ? 'text-white' : 'text-white/40'}`}>
                    <Icon />
                  </span>
                  <span className="flex-1 truncate">{label}</span>
                  {badge && unreadCount > 0 && (
                    <span className="bg-oli-red text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {isFounder && (
          <div>
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest px-3 pt-4 pb-1.5">
              Pessoal
            </p>
            <Link
              href="/meu-recebimento"
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${pathname === '/meu-recebimento'
                  ? 'bg-oli-green text-white shadow-sm'
                  : 'text-white/50 hover:bg-white/6 hover:text-white/80'}`}
            >
              <span className={`shrink-0 ${pathname === '/meu-recebimento' ? 'text-white' : 'text-white/40'}`}>
                <IconCreditCard />
              </span>
              <span className="flex-1 truncate">Meu Recebimento</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer — usuário + logout */}
      <div className="border-t border-white/8 px-3 py-3 space-y-1">
        {/* Info do usuário */}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-oli-green/80 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initial}
          </div>
          <span className="text-white/40 text-xs truncate flex-1">{userEmail}</span>
        </div>

        {/* Botão Sair explícito */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-white/5 hover:bg-oli-red/20 hover:text-oli-red transition-colors group text-white/50 hover:text-oli-red"
          aria-label="Sair da conta"
        >
          <span className="shrink-0">
            <IconLogOut />
          </span>
          <span className="text-sm font-medium">Sair da conta</span>
        </button>
      </div>
    </aside>
  );
}
