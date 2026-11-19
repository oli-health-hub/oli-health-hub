'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavActive, type TabDef } from '@/lib/nav';

/** Barra de abas de um grupo do menu (Reservas, Profissionais, Comercial, Financeiro, Configurações). */
export default function TabNav({ tabs }: { tabs: TabDef[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Abas da seção"
      className="flex gap-1 overflow-x-auto border-b border-oli-border bg-white px-4 pt-3 md:px-7"
    >
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : isNavActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-oli-green text-oli-green'
                : 'border-transparent text-oli-gray hover:text-oli-dark'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
