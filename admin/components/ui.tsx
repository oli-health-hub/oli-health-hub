import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Peças visuais compartilhadas do Admin, no padrão do cabeçalho e do Resumo da ficha do
 * profissional: cartão branco arredondado, ícone em quadrado tingido, indicadores com ícone e
 * selos coloridos. Server components; sem estado.
 */

export type Tom = 'green' | 'gold' | 'red' | 'blue' | 'amber' | 'neutral';

const TOM_ICONE: Record<Tom, string> = {
  green: 'bg-oli-green/10 text-oli-green',
  gold: 'bg-oli-gold/15 text-oli-gold',
  red: 'bg-oli-red/10 text-oli-red',
  blue: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
  neutral: 'bg-gray-100 text-oli-gray',
};

const TOM_SELO: Record<Tom, string> = {
  green: 'bg-green-50 text-oli-green',
  gold: 'bg-oli-gold/15 text-oli-gold',
  red: 'bg-red-50 text-oli-red',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  neutral: 'bg-gray-100 text-oli-gray',
};

/** Selo (pílula) colorido, com ícone opcional. */
export function Selo({ tom = 'neutral', icone: Icone, children }: { tom?: Tom; icone?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${TOM_SELO[tom]}`}>
      {Icone && <Icone className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

export interface KpiDef {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  tom?: Tom;
}

/** Indicador: quadrado de ícone + número + rótulo. No celular empilha, do `sm` para cima fica lado a lado. */
export function Kpi({ icone: Icone, rotulo, valor, tom = 'green' }: KpiDef) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-oli-border bg-oli-bg/40 p-3 sm:flex-row sm:items-center sm:gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TOM_ICONE[tom]}`} aria-hidden="true">
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-oli-dark">{valor}</p>
        <p className="text-[11px] text-oli-lgray">{rotulo}</p>
      </div>
    </div>
  );
}

export function KpiGrade({ kpis }: { kpis: KpiDef[] }) {
  if (kpis.length === 0) return null;
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${kpis.length >= 4 ? 'lg:grid-cols-4' : kpis.length === 3 ? 'lg:grid-cols-3' : ''}`}>
      {kpis.map((k) => (
        <Kpi key={k.rotulo} {...k} />
      ))}
    </div>
  );
}

/**
 * Cabeçalho de página: o `h1` da tela (texto igual ao de antes), subtítulo, selos, uma ação
 * opcional à direita e, abaixo, a grade de indicadores.
 */
export function CabecalhoPagina({
  titulo,
  subtitulo,
  icone: Icone,
  selos,
  acao,
  kpis,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  icone: LucideIcon;
  selos?: ReactNode;
  acao?: ReactNode;
  kpis?: KpiDef[];
}) {
  return (
    <header className="rounded-2xl border border-oli-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oli-green text-white" aria-hidden="true">
            <Icone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold text-oli-dark md:text-2xl">{titulo}</h1>
            {subtitulo && <p className="mt-0.5 text-sm text-oli-gray">{subtitulo}</p>}
            {selos && <div className="mt-2 flex flex-wrap items-center gap-1.5">{selos}</div>}
          </div>
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
      {kpis && kpis.length > 0 && (
        <div className="mt-4">
          <KpiGrade kpis={kpis} />
        </div>
      )}
    </header>
  );
}

/** Cartão de seção: título com ícone (opcional) e ação à direita (opcional). */
export function Painel({
  titulo,
  icone: Icone,
  tom = 'neutral',
  acao,
  children,
}: {
  titulo: string;
  icone?: LucideIcon;
  tom?: Tom;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-oli-border bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-oli-dark">
          {Icone && (
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TOM_ICONE[tom]}`} aria-hidden="true">
              <Icone className="h-3.5 w-3.5" />
            </span>
          )}
          {titulo}
        </h3>
        {acao}
      </div>
      {children}
    </section>
  );
}
