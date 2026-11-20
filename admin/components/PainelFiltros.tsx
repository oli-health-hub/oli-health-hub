'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, SlidersHorizontal, ChevronDown, Users, Sprout, Crown, CheckCircle2, PauseCircle, ShieldAlert, Ban, type LucideIcon } from 'lucide-react';

export type IconePainel = 'todos' | 'start' | 'pro' | 'ativa' | 'pausada' | 'suspensa' | 'banida';
export type TomPainel = 'green' | 'blue' | 'gold' | 'amber' | 'orange' | 'red' | 'gray';

export interface OpcaoPainel {
  valor: string;
  label: string;
  n: number;
  icone?: IconePainel;
  tom?: TomPainel;
}

export interface CampoPainel {
  nome: string;
  rotulo: string;
  atual: string;
  /** Texto da opção "sem filtro" (ex.: "Todas"). */
  todos: string;
  /** `select` = lista suspensa; `chips` = seleção visual com ícone, cor e contagem. */
  tipo: 'select' | 'chips';
  opcoes: OpcaoPainel[];
}

export interface SecaoPainel {
  titulo: string;
  campos: CampoPainel[];
}

const ICONES: Record<IconePainel, LucideIcon> = {
  todos: Users,
  start: Sprout,
  pro: Crown,
  ativa: CheckCircle2,
  pausada: PauseCircle,
  suspensa: ShieldAlert,
  banida: Ban,
};

const TOM_ATIVO: Record<TomPainel, string> = {
  green: 'border-oli-green bg-oli-green text-white',
  blue: 'border-blue-600 bg-blue-600 text-white',
  gold: 'border-oli-gold bg-oli-gold text-white',
  amber: 'border-amber-600 bg-amber-600 text-white',
  orange: 'border-orange-600 bg-orange-600 text-white',
  red: 'border-oli-red bg-oli-red text-white',
  gray: 'border-oli-dark bg-oli-dark text-white',
};
const TOM_REPOUSO: Record<TomPainel, string> = {
  green: 'border-oli-green/30 bg-oli-green/10 text-oli-green',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gold: 'border-oli-gold/40 bg-oli-gold/10 text-oli-gold',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  red: 'border-oli-red/30 bg-oli-red/10 text-oli-red',
  gray: 'border-oli-border bg-white text-oli-gray',
};

/**
 * Painel de filtros das listas do Admin: busca sempre à vista e, atrás do botão "Filtros",
 * os critérios agrupados por assunto. Cada escolha reescreve a URL (`?campo=valor`), então
 * as páginas seguem como server components e cada filtro tem link próprio.
 */
export default function PainelFiltros({
  basePath,
  secoes,
  busca,
  placeholderBusca,
  rotuloItens,
  total,
  totalGeral,
}: {
  basePath: string;
  secoes: SecaoPainel[];
  busca: string;
  placeholderBusca: string;
  rotuloItens: string;
  total: number;
  totalGeral: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(busca);
  const campos = secoes.flatMap((s) => s.campos);
  const ativosLista = campos.filter((c) => c.atual !== 'todos');
  const [aberto, setAberto] = useState(false);

  function navegar(mudancas: Record<string, string>) {
    const params = new URLSearchParams();
    for (const c of campos) if (c.atual !== 'todos') params.set(c.nome, c.atual);
    if (busca) params.set('q', busca);
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === '' || v === 'todos') params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const nAtivos = ativosLista.length + (busca ? 1 : 0);

  return (
    <section aria-label={`Filtros de ${rotuloItens}`} className="rounded-2xl border border-oli-border bg-white">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <form
          className="relative min-w-0 flex-1 basis-56"
          onSubmit={(e) => {
            e.preventDefault();
            navegar({ q: q.trim() });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oli-lgray" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholderBusca}
            aria-label={placeholderBusca.replace('…', '')}
            className="h-10 w-full rounded-xl border border-oli-border bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-oli-green/30"
          />
        </form>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={`Filtros${ativosLista.length ? `, ${ativosLista.length} ativos` : ''}`}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-transform duration-150 ease-out active:scale-[0.97] ${
            aberto || ativosLista.length ? 'border-oli-green bg-oli-green/10 text-oli-green' : 'border-oli-border bg-white text-oli-dark'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtros
          {ativosLista.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-oli-green px-1 text-[11px] text-white">{ativosLista.length}</span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-150 ease-out ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {(ativosLista.length > 0 || busca) && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
          {ativosLista.map((c) => {
            const op = c.opcoes.find((o) => o.valor === c.atual);
            return (
              <button
                key={c.nome}
                type="button"
                onClick={() => navegar({ [c.nome]: 'todos' })}
                aria-label={`Remover filtro ${c.rotulo}: ${op?.label ?? c.atual}`}
                className="inline-flex items-center gap-1 rounded-full bg-oli-green/10 px-2.5 py-1 text-xs font-semibold text-oli-green transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                {c.rotulo}: {op?.label ?? c.atual}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            );
          })}
          {busca && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                navegar({ q: '' });
              }}
              aria-label={`Remover a busca por ${busca}`}
              className="inline-flex items-center gap-1 rounded-full bg-oli-green/10 px-2.5 py-1 text-xs font-semibold text-oli-green transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Busca: {busca}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setQ('');
              router.push(basePath);
            }}
            aria-label="Limpar todos os filtros"
            className="px-1.5 py-1 text-xs font-semibold text-oli-gray underline-offset-2 hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {aberto && (
        <div className="grid gap-4 border-t border-oli-border bg-oli-bg/40 p-3 md:grid-cols-2 xl:grid-cols-3">
          {secoes.map((s) => (
            <fieldset key={s.titulo} className="min-w-0 space-y-2.5">
              <legend className="mb-1 text-[11px] font-bold uppercase tracking-wider text-oli-lgray">{s.titulo}</legend>
              {s.campos.map((c) =>
                c.tipo === 'select' ? (
                  <label key={c.nome} className="block min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-oli-dark">{c.rotulo}</span>
                    <select
                      value={c.atual}
                      onChange={(e) => navegar({ [c.nome]: e.target.value })}
                      aria-label={`Filtrar por ${c.rotulo.toLowerCase()}`}
                      className={`h-9 w-full min-w-0 rounded-xl border bg-white px-2.5 text-sm text-oli-dark focus:outline-none focus:ring-2 focus:ring-oli-green/30 ${
                        c.atual !== 'todos' ? 'border-oli-green bg-oli-green/5 font-semibold' : 'border-oli-border'
                      }`}
                    >
                      <option value="todos">{c.todos}</option>
                      {c.opcoes.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.label} ({o.n})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div key={c.nome} role="group" aria-label={`Filtrar por ${c.rotulo.toLowerCase()}`}>
                    <span className="mb-1 block text-xs font-semibold text-oli-dark">{c.rotulo}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ valor: 'todos', label: c.todos, n: 0, icone: 'todos' as IconePainel, tom: 'gray' as TomPainel }, ...c.opcoes].map((o, i) => {
                        const ativo = c.atual === o.valor;
                        const tom = o.tom ?? 'gray';
                        const Icone = o.icone ? ICONES[o.icone] : null;
                        return (
                          <button
                            key={o.valor}
                            type="button"
                            onClick={() => navegar({ [c.nome]: o.valor })}
                            aria-pressed={ativo}
                            aria-label={`${c.rotulo}: ${o.label}${i === 0 ? '' : `, ${o.n}`}`}
                            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ${
                              ativo ? TOM_ATIVO[tom] : `${TOM_REPOUSO[tom]} hover:brightness-95`
                            }`}
                          >
                            {Icone && <Icone className="h-3.5 w-3.5" aria-hidden="true" />}
                            {o.label}
                            {i > 0 && <span className="opacity-70">{o.n}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </fieldset>
          ))}
        </div>
      )}

      <p className="border-t border-oli-border px-3 py-2 text-xs text-oli-gray">
        Mostrando <strong className="text-oli-dark">{total}</strong> de {totalGeral} {rotuloItens}
        {nAtivos > 0 ? ` · ${nAtivos} ${nAtivos === 1 ? 'filtro ativo' : 'filtros ativos'}` : ''}
      </p>
    </section>
  );
}
