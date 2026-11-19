'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { MAIN_NAV, isNavActive } from '@/lib/nav';

// ─── SVG Icons (inline — sem dependência externa) ─────────────────────────────

const SVG_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function IconHoje() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg {...SVG_PROPS}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconCreditCard() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg {...SVG_PROPS}>
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

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Navegação ────────────────────────────────────────────────────────────────

// Menu de 6 itens. As telas de cada grupo viram abas (ver lib/nav.ts e os layout.tsx de cada grupo).
const ICON_BY_HREF: Record<string, () => JSX.Element> = {
  '/': IconHoje,
  '/reservas': IconCalendar,
  '/medicos': IconUsers,
  '/comercial': IconInbox,
  '/financeiro': IconCreditCard,
  '/configuracoes': IconSettings,
};

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  userEmail: string;
}

export default function Sidebar({ userEmail }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  // Sidebar sempre visível no desktop; no celular vira gaveta (drawer) aberta
  // por um botão flutuante, pra não comer 240px de uma tela de ~375px.
  const [aberta, setAberta] = useState(false);

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
  }

  const initial = userEmail?.[0]?.toUpperCase() ?? 'A';

  return (
    <>
      {/* Botão flutuante — só no celular. Fica embaixo à esquerda de propósito:
          topo já é onde cada página põe título/ações, um botão fixo ali em
          cima colidiria. */}
      <button
        onClick={() => setAberta(v => !v)}
        aria-label={aberta ? 'Fechar menu' : 'Abrir menu'}
        className="md:hidden fixed bottom-4 left-4 z-50 w-12 h-12 rounded-full bg-oli-sidebar text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        {aberta ? <IconX /> : <IconMenu />}
      </button>

      {/* Fundo escurecido atrás da gaveta — clicar fecha. */}
      {aberta && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setAberta(false)}
        />
      )}

      <aside className={`flex flex-col w-60 min-w-[240px] bg-oli-sidebar h-screen fixed md:sticky top-0 left-0 z-40 md:z-auto transition-transform duration-200 ease-out ${
        aberta ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>

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
      <nav aria-label="Menu principal" className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {MAIN_NAV.map(({ href, label }) => {
          const active = isNavActive(pathname, href);
          const Icon = ICON_BY_HREF[href];
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setAberta(false)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${active
                  ? 'bg-oli-green text-white shadow-sm'
                  : 'text-white/50 hover:bg-white/6 hover:text-white/80'}`}
            >
              <span className={`shrink-0 ${active ? 'text-white' : 'text-white/40'}`}>
                <Icon />
              </span>
              <span className="flex-1 truncate">{label}</span>
            </Link>
          );
        })}
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
    </>
  );
}
