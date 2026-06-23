import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/* ─── helpers ─── */
const SP = 'America/Sao_Paulo';

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: SP });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP });
}
function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}min` : ''}`.trim() : `${m}min`;
}

/* ─── status maps ─── */
const STATUS_COLOR: Record<string, string> = {
  active:          'bg-green-50 text-oli-green',
  ACTIVE:          'bg-green-50 text-oli-green',
  pending:         'bg-yellow-50 text-yellow-700',
  pending_payment: 'bg-yellow-50 text-yellow-700',
  PENDING:         'bg-yellow-50 text-yellow-700',
  cancelled:       'bg-red-50 text-oli-red',
  CANCELLED:       'bg-red-50 text-oli-red',
  inactive:        'bg-gray-100 text-gray-500',
  INACTIVE:        'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  active:          'Ativo',
  ACTIVE:          'Ativo',
  pending:         'Pendente',
  pending_payment: 'Pendente',
  PENDING:         'Pendente',
  cancelled:       'Cancelado',
  CANCELLED:       'Cancelado',
  inactive:        'Inativo',
  INACTIVE:        'Inativo',
};
const TIPO_LABEL: Record<string, string> = {
  subscription:  'Assinatura',
  hour_package:  'Pacote de horas',
  pay_per_use:   'Avulso',
};

const PAGE_SIZE = 50;

/* ─── types ─── */
type UsageRow = {
  id: string;
  iniciado_em: string;
  encerrado_em: string;
  minutos: number;
  taxa_min: number;
  valor_total: number;
  tipo_cobranca: string;
  reservation_id: string | null;
  profiles: { id: string; nome: string } | null;
};
type SubRow = {
  id: string;
  status: string;
  ciclo: string;
  starts_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
  profiles: { id: string; nome: string } | null;
  plans: { name: string; preco_mensal: number; preco_anual: number } | null;
};
type ModRow = {
  id: string;
  status: string;
  activated_at: string | null;
  ativo_ate: string | null;
  created_at: string;
  profiles: { id: string; nome: string } | null;
  modules: { nome: string; valor: number; categoria: string } | null;
};

/* ─── page ─── */
export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = await createSupabaseServer();

  /* defaults: mês corrente */
  const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
  const defaultFrom = new Date(nowSP.getFullYear(), nowSP.getMonth(), 1)
    .toISOString().slice(0, 10);
  const defaultTo = new Date(nowSP.getFullYear(), nowSP.getMonth() + 1, 0)
    .toISOString().slice(0, 10);

  const from    = searchParams.from ?? defaultFrom;
  const to      = searchParams.to   ?? defaultTo;
  const q       = searchParams.q    ?? '';
  const tipo    = searchParams.tipo ?? 'all';
  const page    = Math.max(1, parseInt(searchParams.page ?? '1', 10));

  const fromISO = new Date(from + 'T00:00:00-03:00').toISOString();
  const toISO   = new Date(to   + 'T23:59:59-03:00').toISOString();

  /* ── queries em paralelo ── */
  const [
    { data: usageRaw,  count: usageTotal },
    { data: subsRaw },
    { data: modsRaw },
    /* KPI: receita de minutagem no período (todos os docs) */
    { data: kpiUsage },
  ] = await Promise.all([
    /* minutagem — paginada */
    supabase
      .from('usage_charges')
      .select('id, iniciado_em, encerrado_em, minutos, taxa_min, valor_total, tipo_cobranca, reservation_id, profiles(id, nome)', { count: 'exact' })
      .gte('iniciado_em', fromISO)
      .lte('iniciado_em', toISO)
      .order('iniciado_em', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),

    /* assinaturas */
    supabase
      .from('subscriptions')
      .select('id, status, ciclo, starts_at, ends_at, cancelled_at, profiles(id, nome), plans(name, preco_mensal, preco_anual)')
      .order('created_at', { ascending: false })
      .limit(200),

    /* módulos */
    supabase
      .from('user_modules')
      .select('id, status, activated_at, ativo_ate, created_at, profiles(id, nome), modules(nome, valor, categoria)')
      .order('created_at', { ascending: false })
      .limit(200),

    /* KPI de receita (sem paginação, só valores) */
    supabase
      .from('usage_charges')
      .select('valor_total')
      .gte('iniciado_em', fromISO)
      .lte('iniciado_em', toISO),
  ]);

  const usage = (usageRaw as unknown as UsageRow[]) ?? [];
  const subs  = (subsRaw  as unknown as SubRow[])   ?? [];
  const mods  = (modsRaw  as unknown as ModRow[])   ?? [];

  /* KPIs */
  const receitaMinutagem = (kpiUsage ?? []).reduce((s: number, r: { valor_total: number }) => s + (r.valor_total ?? 0), 0);
  const subsAtivas       = subs.filter(s => s.status === 'active' || s.status === 'ACTIVE');
  const receitaAssinaturas = subsAtivas.reduce((s, sub) => {
    const plan  = sub.plans;
    const valor = sub.ciclo === 'YEARLY' ? (plan?.preco_anual ?? 0) : (plan?.preco_mensal ?? 0);
    return s + valor;
  }, 0);
  const modsAtivos = mods.filter(m => m.status === 'active' || m.status === 'ACTIVE');
  const receitaModulos = modsAtivos.reduce((s, m) => s + (m.modules?.valor ?? 0), 0);
  const totalGeral = receitaMinutagem + receitaAssinaturas + receitaModulos;

  /* filtro por nome (client-side para subs + mods, já que são poucos) */
  const filteredSubs = q
    ? subs.filter(s => s.profiles?.nome?.toLowerCase().includes(q.toLowerCase()))
    : subs;
  const filteredMods = q
    ? mods.filter(m => m.profiles?.nome?.toLowerCase().includes(q.toLowerCase()))
    : mods;

  /* paginação */
  const totalPages = Math.ceil((usageTotal ?? 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams({
      from, to, q, tipo, page: String(page), ...Object.fromEntries(
        Object.entries(overrides).map(([k, v]) => [k, String(v)])
      ),
    });
    return `/pagamentos?${p.toString()}`;
  }

  const showUsage = tipo === 'all' || tipo === 'minutagem';
  const showSubs  = tipo === 'all' || tipo === 'assinaturas';
  const showMods  = tipo === 'all' || tipo === 'modulos';

  return (
    <div className="p-7 space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-oli-dark">Minutagem por Sessão</h1>
        <p className="text-sm text-oli-lgray">
          Período: {new Date(from + 'T12:00:00').toLocaleDateString('pt-BR')} – {new Date(to + 'T12:00:00').toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Minutagem (período)</p>
          <p className="text-2xl font-extrabold text-oli-dark leading-none mt-2">
            {fmtBRL(receitaMinutagem)}
          </p>
          <p className="mt-1.5 text-[10px] text-oli-lgray">{usageTotal ?? 0} sessões</p>
        </div>
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Assinaturas ativas</p>
          <p className="text-2xl font-extrabold text-oli-dark leading-none mt-2">
            {fmtBRL(receitaAssinaturas)}
          </p>
          <p className="mt-1.5 text-[10px] text-oli-lgray">{subsAtivas.length} assinaturas</p>
        </div>
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Módulos ativos</p>
          <p className="text-2xl font-extrabold text-oli-dark leading-none mt-2">
            {fmtBRL(receitaModulos)}
          </p>
          <p className="mt-1.5 text-[10px] text-oli-lgray">{modsAtivos.length} módulos</p>
        </div>
        <div className="bg-white rounded-2xl border border-oli-border p-4 border-oli-green/30">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Total consolidado</p>
          <p className="text-2xl font-extrabold text-oli-green leading-none mt-2">
            {fmtBRL(totalGeral)}
          </p>
          <p className="mt-1.5 text-[10px] text-oli-lgray">todas as fontes</p>
        </div>
      </div>

      {/* Filtros */}
      <form method="GET" className="bg-white rounded-2xl border border-oli-border p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">De</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Até</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Tipo</label>
            <select
              name="tipo"
              defaultValue={tipo}
              className="text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green bg-white"
            >
              <option value="all">Todos</option>
              <option value="minutagem">Minutagem</option>
              <option value="assinaturas">Assinaturas</option>
              <option value="modulos">Módulos</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Médico</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Nome do médico…"
              className="text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green w-48"
            />
          </div>
          <button
            type="submit"
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-oli-green text-white hover:bg-oli-green/80 transition-colors"
          >
            Filtrar
          </button>
          <a
            href="/pagamentos"
            className="text-sm font-semibold px-4 py-2 rounded-xl border border-oli-border text-oli-lgray hover:bg-stone-50 transition-colors"
          >
            Limpar
          </a>
        </div>
      </form>

      {/* ── Minutagem ── */}
      {showUsage && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-oli-dark">
              Minutagem
              <span className="ml-2 text-oli-lgray font-normal text-xs">
                {usageTotal ?? 0} sessões no período · {fmtBRL(receitaMinutagem)}
              </span>
            </h2>
            {totalPages > 1 && (
              <span className="text-xs text-oli-lgray">
                Página {page}/{totalPages}
              </span>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-oli-border">
                    {['Médico', 'Data', 'Início', 'Fim', 'Duração', 'Taxa/min', 'Valor', 'Tipo'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-oli-border">
                  {usage.map(u => {
                    const prof = u.profiles;
                    return (
                      <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3">
                          {prof ? (
                            <Link href={`/medicos/${prof.id}`} className="font-medium text-oli-dark hover:text-oli-green transition-colors">
                              {prof.nome}
                            </Link>
                          ) : (
                            <span className="text-oli-lgray">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">{fmtDate(u.iniciado_em)}</td>
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">{fmtTime(u.iniciado_em)}</td>
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">{fmtTime(u.encerrado_em)}</td>
                        <td className="px-4 py-3 text-oli-dark font-medium whitespace-nowrap">{fmtDuration(u.minutos)}</td>
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                          R$ {Number(u.taxa_min).toFixed(2).replace('.', ',')}/min
                        </td>
                        <td className="px-4 py-3 font-semibold text-oli-dark whitespace-nowrap">
                          {fmtBRL(Number(u.valor_total))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {TIPO_LABEL[u.tipo_cobranca] ?? u.tipo_cobranca}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {usage.length === 0 && (
                <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                  Nenhuma sessão cobrada no período
                </div>
              )}
            </div>
          </div>

          {/* paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-oli-lgray">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, usageTotal ?? 0)} de {usageTotal} registros
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a href={buildUrl({ page: page - 1 })}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-oli-border text-oli-lgray hover:bg-stone-50 transition-colors">
                    ← Anterior
                  </a>
                )}
                {page < totalPages && (
                  <a href={buildUrl({ page: page + 1 })}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-oli-border text-oli-lgray hover:bg-stone-50 transition-colors">
                    Próxima →
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Assinaturas ── */}
      {showSubs && (
        <section>
          <h2 className="text-sm font-bold text-oli-dark mb-3">
            Assinaturas de plano
            <span className="ml-2 text-oli-lgray font-normal text-xs">
              {filteredSubs.length} registros · {subsAtivas.length} ativas
            </span>
          </h2>
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-oli-border">
                    {['Médico', 'Plano', 'Ciclo', 'Valor', 'Status', 'Início', 'Vencimento'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-oli-border">
                  {filteredSubs.map(sub => {
                    const prof  = sub.profiles;
                    const plan  = sub.plans;
                    const valor = sub.ciclo === 'YEARLY' ? plan?.preco_anual : plan?.preco_mensal;
                    const status = sub.status ?? 'inactive';
                    return (
                      <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3">
                          {prof ? (
                            <Link href={`/medicos/${prof.id}`} className="font-medium text-oli-dark hover:text-oli-green transition-colors">
                              {prof.nome}
                            </Link>
                          ) : <span className="text-oli-lgray">—</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-oli-dark">{plan?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-oli-gray">{sub.ciclo === 'YEARLY' ? 'Anual' : 'Mensal'}</td>
                        <td className="px-4 py-3 font-semibold text-oli-dark whitespace-nowrap">
                          {valor != null ? fmtBRL(Number(valor)) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">{fmtDate(sub.starts_at)}</td>
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                          {sub.ends_at ? fmtDate(sub.ends_at) : sub.cancelled_at ? `Cancelado ${fmtDate(sub.cancelled_at)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredSubs.length === 0 && (
                <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                  Nenhuma assinatura encontrada
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Módulos ── */}
      {showMods && (
        <section>
          <h2 className="text-sm font-bold text-oli-dark mb-3">
            Módulos contratados
            <span className="ml-2 text-oli-lgray font-normal text-xs">
              {filteredMods.length} registros · {modsAtivos.length} ativos
            </span>
          </h2>
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-oli-border">
                    {['Médico', 'Módulo', 'Categoria', 'Valor', 'Status', 'Ativado em', 'Válido até'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-oli-border">
                  {filteredMods.map(m => {
                    const prof   = m.profiles;
                    const module = m.modules;
                    const status = m.status ?? 'inactive';
                    return (
                      <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3">
                          {prof ? (
                            <Link href={`/medicos/${prof.id}`} className="font-medium text-oli-dark hover:text-oli-green transition-colors">
                              {prof.nome}
                            </Link>
                          ) : <span className="text-oli-lgray">—</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-oli-dark">{module?.nome ?? '—'}</td>
                        <td className="px-4 py-3 text-oli-gray capitalize">{module?.categoria ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold text-oli-dark whitespace-nowrap">
                          {module?.valor != null ? fmtBRL(Number(module.valor)) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                          {m.activated_at ? fmtDate(m.activated_at) : '—'}
                        </td>
                        <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                          {m.ativo_ate ? fmtDate(m.ativo_ate) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredMods.length === 0 && (
                <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                  Nenhum módulo encontrado
                </div>
              )}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
