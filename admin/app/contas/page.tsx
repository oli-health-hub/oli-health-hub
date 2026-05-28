import { createSupabaseServer } from '@/lib/supabase-server';
import { upsertFinancialEntry, markEntryPaid, cancelEntry } from '@/app/actions';
import {
  getPaymentsByDueDate,
  PAYMENT_STATUS_MAP,
  BILLING_TYPE_MAP,
  CYCLE_MAP,
  cycleToMonthlyFactor,
  AsaasNotConfiguredError,
  type AsaasPayment,
  type AsaasSubscription,
} from '@/lib/asaas';

export const dynamic = 'force-dynamic';

const SP = 'America/Sao_Paulo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}
function today() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
}
function isoToday() {
  const d = today();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoFirstDay(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
function isoLastDay(year: number, month: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}
function monthLabel(year: number, month: number) {
  return new Date(year, month, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());
}
function addMonths(year: number, month: number, n: number) {
  const d = new Date(year, month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// ─── Projeção mensal dos planos ────────────────────────────────────────────────
// Calcula receita provisionada por mês para os próximos 12 meses
// Fonte: nossa tabela subscriptions + plans (sem precisar da API Asaas)

type SubWithPlan = {
  id:          string;
  ciclo:       string | null;
  starts_at:   string | null;
  ends_at:     string | null;
  status:      string;
  plans:       { nome: string; preco_mensal: number | null; preco_anual: number | null } | null;
  profiles:    { nome: string } | null;
};

function calcProvision(sub: SubWithPlan, year: number, month: number): number {
  if (!sub.plans) return 0;
  const ciclo = (sub.ciclo ?? 'mensal').toLowerCase();
  const isAnual = ciclo === 'anual' || ciclo === 'yearly';
  const valor = isAnual
    ? (sub.plans.preco_anual ?? 0) / 12
    : (sub.plans.preco_mensal ?? 0);
  // Verificar se assinatura está ativa neste mês
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  const start = sub.starts_at ? new Date(sub.starts_at) : null;
  const end   = sub.ends_at   ? new Date(sub.ends_at)   : null;
  if (start && start > monthEnd) return 0;
  if (end   && end   < monthStart) return 0;
  return valor;
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type EnrichedPayment = AsaasPayment & {
  medicoNome:  string;
  planNome:    string;
  sourceTipo:  'plano' | 'modulo' | 'horas' | 'avulso';
};

type FinEntry = {
  id: string; tipo: string; descricao: string; valor: number;
  vencimento: string; pago_em: string | null; status: string;
  categoria: string | null;
  suppliers: { nome: string } | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const tab = (searchParams.tab ?? 'receitas') as 'receitas' | 'projecao' | 'pagar';

  const nowSP     = today();
  const viewYear  = parseInt(searchParams.year  ?? String(nowSP.getFullYear()));
  const viewMonth = parseInt(searchParams.month ?? String(nowSP.getMonth()));
  const todayISO  = isoToday();
  const mStart    = isoFirstDay(viewYear, viewMonth);
  const mEnd      = isoLastDay(viewYear, viewMonth);
  const mLabel    = monthLabel(viewYear, viewMonth);
  const { year: prevYear, month: prevMonth } = addMonths(viewYear, viewMonth, -1);
  const { year: nextYear, month: nextMonth } = addMonths(viewYear, viewMonth,  1);

  const supabase = await createSupabaseServer();

  // ── Dados do Supabase ──────────────────────────────────────────────────────

  const [
    { data: subs },
    { data: userModules },
    { data: hourBalances },
    { data: payEntries },
    { data: suppliers },
  ] = await Promise.all([
    // Assinaturas ativas com ID Asaas + plano + médico
    supabase.from('subscriptions')
      .select('id, ciclo, starts_at, ends_at, status, asaas_id_plain, plans(nome, preco_mensal, preco_anual), profiles(nome)')
      .not('asaas_id_plain', 'is', null)
      .in('status', ['active', 'pending_payment'])
      .limit(200),

    // Módulos com ID Asaas (produtos adquiridos à parte)
    supabase.from('user_modules')
      .select('id, asaas_id_plain, profiles(nome), modules(nome, valor)')
      .not('asaas_id_plain', 'is', null)
      .limit(200),

    // Pacotes de horas com charge ID Asaas
    supabase.from('hour_balance')
      .select('id, asaas_charge_id, profiles(nome)')
      .not('asaas_charge_id', 'is', null)
      .limit(200),

    // Contas a pagar (manual)
    supabase.from('financial_entries')
      .select('*, suppliers(nome)')
      .eq('tipo', 'pagar')
      .gte('vencimento', mStart)
      .lte('vencimento', mEnd)
      .order('vencimento', { ascending: true })
      .limit(200),

    // Fornecedores para o form
    supabase.from('suppliers')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome', { ascending: true }),
  ]);

  // Helper: Supabase joins retornam array quando é FK; pega primeiro elemento
  function firstRow<T>(v: T | T[] | null): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }

  // Mapas de lookup: asaas_id_plain → metadados
  const subMap: Record<string, { medicoNome: string; planNome: string }> = {};
  (subs ?? []).forEach(s => {
    if (s.asaas_id_plain) {
      const prof = firstRow(s.profiles as { nome: string } | { nome: string }[] | null);
      const plan = firstRow(s.plans   as { nome: string; preco_mensal: number | null; preco_anual: number | null } | { nome: string; preco_mensal: number | null; preco_anual: number | null }[] | null);
      subMap[s.asaas_id_plain] = {
        medicoNome: prof?.nome ?? '—',
        planNome:   plan?.nome ?? '—',
      };
    }
  });

  const moduleMap: Record<string, { medicoNome: string; modNome: string }> = {};
  (userModules ?? []).forEach(m => {
    if (m.asaas_id_plain) {
      const prof = firstRow(m.profiles as { nome: string } | { nome: string }[] | null);
      const mod  = firstRow(m.modules  as { nome: string; valor: number | null } | { nome: string; valor: number | null }[] | null);
      moduleMap[m.asaas_id_plain] = {
        medicoNome: prof?.nome ?? '—',
        modNome:    mod?.nome  ?? 'Módulo',
      };
    }
  });

  const horasMap: Record<string, { medicoNome: string }> = {};
  (hourBalances ?? []).forEach(h => {
    if (h.asaas_charge_id) {
      const prof = firstRow(h.profiles as { nome: string } | { nome: string }[] | null);
      horasMap[h.asaas_charge_id] = { medicoNome: prof?.nome ?? '—' };
    }
  });

  // ── Asaas: pagamentos do mês ───────────────────────────────────────────────

  let asaasConfigured = true;
  let enrichedPayments: EnrichedPayment[] = [];
  let asaasError: string | null = null;

  if (tab === 'receitas') {
    try {
      const result = await getPaymentsByDueDate({ dueDateFrom: mStart, dueDateTo: mEnd, limit: 100 });
      enrichedPayments = (result.data ?? []).map((p): EnrichedPayment => {
        // Tenta identificar origem: assinatura → módulo → horas → avulso
        if (p.subscription && subMap[p.subscription]) {
          return { ...p, ...subMap[p.subscription], sourceTipo: 'plano' };
        }
        if (p.id && moduleMap[p.id]) {
          const m = moduleMap[p.id];
          return { ...p, medicoNome: m.medicoNome, planNome: m.modNome, sourceTipo: 'modulo' };
        }
        if (p.id && horasMap[p.id]) {
          return { ...p, medicoNome: horasMap[p.id].medicoNome, planNome: 'Pacote de horas', sourceTipo: 'horas' };
        }
        return { ...p, medicoNome: p.description ?? '—', planNome: 'Avulso', sourceTipo: 'avulso' };
      });
    } catch (e) {
      if (e instanceof AsaasNotConfiguredError) {
        asaasConfigured = false;
      } else {
        asaasError = (e as Error).message;
      }
    }
  }

  // ── Projeção: 12 meses à frente ────────────────────────────────────────────

  type MonthProjection = {
    year: number; month: number;
    mensal: number; anual: number; total: number;
    breakdown: { nome: string; valor: number; ciclo: string; medicoNome: string }[];
  };

  const projections: MonthProjection[] = [];

  if (tab === 'projecao') {
    // Normaliza joins que podem chegar como array
    const allSubs: SubWithPlan[] = (subs ?? []).map(s => ({
      ...s,
      plans:    firstRow(s.plans    as Parameters<typeof firstRow>[0]) as SubWithPlan['plans'],
      profiles: firstRow(s.profiles as Parameters<typeof firstRow>[0]) as SubWithPlan['profiles'],
    }));
    for (let i = 0; i < 12; i++) {
      const { year: py, month: pm } = addMonths(nowSP.getFullYear(), nowSP.getMonth(), i);
      let mensal = 0; let anual = 0;
      const breakdown: MonthProjection['breakdown'] = [];
      allSubs.forEach(s => {
        const v = calcProvision(s, py, pm);
        if (v <= 0) return;
        const ciclo = (s.ciclo ?? 'mensal').toLowerCase();
        const isAnual = ciclo === 'anual' || ciclo === 'yearly';
        if (isAnual) anual += v; else mensal += v;
        breakdown.push({
          nome:       firstRow(s.plans    as { nome: string } | { nome: string }[] | null)?.nome ?? '—',
          valor:      v,
          ciclo:      ciclo,
          medicoNome: firstRow(s.profiles as { nome: string } | { nome: string }[] | null)?.nome ?? '—',
        });
      });
      projections.push({ year: py, month: pm, mensal, anual, total: mensal + anual, breakdown });
    }
  }

  // ── KPIs receitas ──────────────────────────────────────────────────────────

  const recebido = enrichedPayments
    .filter(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH')
    .reduce((s, p) => s + p.netValue, 0);
  const pendente = enrichedPayments
    .filter(p => p.status === 'PENDING')
    .reduce((s, p) => s + p.value, 0);
  const vencido  = enrichedPayments
    .filter(p => p.status === 'OVERDUE')
    .reduce((s, p) => s + p.value, 0);
  const totalPagar = (payEntries ?? [])
    .filter(e => e.status !== 'cancelado')
    .reduce((s, e) => s + (e.valor ?? 0), 0);

  // Projeção mês atual
  const projAtual = projections.find(p => p.year === viewYear && p.month === viewMonth);
  const maxProj = projections.length > 0 ? Math.max(...projections.map(p => p.total), 1) : 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabBase = `/contas?year=${viewYear}&month=${viewMonth}`;

  return (
    <div className="p-7 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Contas a Pagar / Receber</h1>
          <p className="text-sm text-oli-lgray mt-0.5">{mLabel}</p>
        </div>
        {/* Nav mês */}
        <div className="flex items-center gap-1">
          <a href={`${tabBase.replace(`year=${viewYear}&month=${viewMonth}`, `year=${prevYear}&month=${prevMonth}`)}&tab=${tab}`}
             className="px-3 py-1.5 text-oli-lgray hover:text-oli-dark hover:bg-white rounded-xl border border-oli-border text-sm transition-colors">
            ‹
          </a>
          <span className="px-4 py-1.5 text-sm font-semibold text-oli-dark bg-white border border-oli-border rounded-xl">{mLabel}</span>
          <a href={`${tabBase.replace(`year=${viewYear}&month=${viewMonth}`, `year=${nextYear}&month=${nextMonth}`)}&tab=${tab}`}
             className="px-3 py-1.5 text-oli-lgray hover:text-oli-dark hover:bg-white rounded-xl border border-oli-border text-sm transition-colors">
            ›
          </a>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Recebido no mês</p>
          <p className="text-2xl font-extrabold text-emerald-600">{fmtBRL(recebido)}</p>
          <p className="text-[11px] text-oli-lgray mt-0.5">confirmado / recebido</p>
        </div>
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">A receber</p>
          <p className="text-2xl font-extrabold text-blue-600">{fmtBRL(pendente)}</p>
          <p className="text-[11px] text-oli-lgray mt-0.5">pendente de confirmação</p>
        </div>
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Em atraso</p>
          <p className={`text-2xl font-extrabold ${vencido > 0 ? 'text-red-600' : 'text-oli-dark'}`}>{fmtBRL(vencido)}</p>
          <p className="text-[11px] text-oli-lgray mt-0.5">vencido sem confirmação</p>
        </div>
        <div className="bg-white rounded-2xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">A pagar no mês</p>
          <p className="text-2xl font-extrabold text-red-600">{fmtBRL(totalPagar)}</p>
          <p className="text-[11px] text-oli-lgray mt-0.5">contas cadastradas</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-oli-border pb-0">
        {([
          { key: 'receitas', label: 'Receitas (Asaas)' },
          { key: 'projecao', label: 'Projeção 12 meses' },
          { key: 'pagar',    label: 'A pagar' },
        ] as const).map(({ key, label }) => (
          <a
            key={key}
            href={`${tabBase}&tab=${key}`}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl border border-b-0 transition-colors
              ${tab === key
                ? 'bg-white border-oli-border text-oli-dark -mb-px'
                : 'border-transparent text-oli-lgray hover:text-oli-dark'}`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: RECEITAS (Asaas)
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'receitas' && (
        <div className="space-y-4">
          {!asaasConfigured ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 flex items-start gap-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p className="text-sm font-bold text-yellow-800">Asaas não configurado</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Adicione <code className="bg-yellow-100 px-1 rounded">ASAAS_API_KEY</code> nas variáveis de ambiente do Vercel para ver os pagamentos reais.
                  Use <code className="bg-yellow-100 px-1 rounded">ASAAS_ENV=sandbox</code> para ambiente de testes.
                </p>
              </div>
            </div>
          ) : asaasError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
              Erro ao buscar pagamentos: {asaasError}
            </div>
          ) : enrichedPayments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-oli-border flex flex-col items-center justify-center py-16 text-oli-lgray">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              <p className="text-sm font-semibold">Nenhum pagamento em {mLabel}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-oli-border flex items-center justify-between">
                <h2 className="text-sm font-bold text-oli-dark">Pagamentos — {mLabel}</h2>
                <span className="text-[10px] text-oli-lgray">{enrichedPayments.length} registros</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider border-b border-oli-border">
                      <th className="text-left px-5 py-3">Vencimento</th>
                      <th className="text-left px-4 py-3">Médico</th>
                      <th className="text-left px-4 py-3">Modalidade / Produto</th>
                      <th className="text-left px-4 py-3">Origem</th>
                      <th className="text-left px-4 py-3">Forma</th>
                      <th className="text-right px-4 py-3">Valor bruto</th>
                      <th className="text-right px-4 py-3">Valor líquido</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-oli-border">
                    {enrichedPayments.map(p => {
                      const st = PAYMENT_STATUS_MAP[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-500' };
                      const sourceColors: Record<string, string> = {
                        plano:  'bg-purple-50 text-purple-700',
                        modulo: 'bg-blue-50 text-blue-700',
                        horas:  'bg-amber-50 text-amber-700',
                        avulso: 'bg-gray-100 text-gray-500',
                      };
                      const sourceLabels: Record<string, string> = {
                        plano: 'Plano', modulo: 'Módulo', horas: 'Horas', avulso: 'Avulso',
                      };
                      return (
                        <tr key={p.id} className="hover:bg-oli-bg/60 transition-colors">
                          <td className="px-5 py-3 text-[12px] font-semibold text-oli-dark whitespace-nowrap">
                            {fmtDate(p.dueDate)}
                            {p.paymentDate && (
                              <p className="text-[10px] text-oli-lgray font-normal">Pago: {fmtDate(p.paymentDate)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[12px] text-oli-dark font-medium">{p.medicoNome}</td>
                          <td className="px-4 py-3 text-[12px] text-oli-dark">{p.planNome}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sourceColors[p.sourceTipo]}`}>
                              {sourceLabels[p.sourceTipo]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-oli-lgray">
                            {BILLING_TYPE_MAP[p.billingType] ?? p.billingType}
                          </td>
                          <td className="px-4 py-3 text-right text-[12px] font-semibold text-oli-dark">
                            {fmtBRL(p.value)}
                          </td>
                          <td className="px-4 py-3 text-right text-[12px] font-bold text-emerald-700">
                            {fmtBRL(p.netValue)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-oli-border bg-oli-bg/50">
                      <td colSpan={5} className="px-5 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                        Total do mês
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-sm text-oli-dark">
                        {fmtBRL(enrichedPayments.filter(p => p.status !== 'CANCELLED' && p.status !== 'REFUNDED').reduce((s, p) => s + p.value, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-sm text-emerald-700">
                        {fmtBRL(recebido)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: PROJEÇÃO 12 MESES
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'projecao' && (
        <div className="space-y-4">

          {/* Gráfico de barras CSS */}
          <div className="bg-white rounded-2xl border border-oli-border p-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-oli-dark">Projeção de receita — próximos 12 meses</h2>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-oli-green inline-block" /> Mensal
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-oli-gold inline-block" /> Anual provisionado
                </span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-40">
              {projections.map((p) => {
                const totalBar = maxProj > 0 ? (p.total / maxProj) * 100 : 0;
                const mensalBar = p.total > 0 ? (p.mensal / p.total) * totalBar : 0;
                const anualBar  = totalBar - mensalBar;
                const isCurrentMonth = p.year === nowSP.getFullYear() && p.month === nowSP.getMonth();
                const label = new Date(p.year, p.month, 1)
                  .toLocaleDateString('pt-BR', { month: 'short' })
                  .replace('.', '');
                return (
                  <div key={`${p.year}-${p.month}`} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-oli-dark text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {fmtBRL(p.total)}
                    </div>
                    {/* Barra empilhada */}
                    <div className="w-full flex flex-col justify-end" style={{ height: '128px' }}>
                      <div
                        className="w-full rounded-t-md overflow-hidden flex flex-col"
                        style={{ height: `${Math.max(totalBar, 2)}%` }}
                      >
                        <div className="w-full" style={{ flex: anualBar, background: '#B8893C', minHeight: anualBar > 0 ? '2px' : '0' }} />
                        <div className="w-full" style={{ flex: mensalBar, background: '#5F7D67', minHeight: mensalBar > 0 ? '2px' : '0' }} />
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold ${isCurrentMonth ? 'text-oli-green' : 'text-oli-lgray'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela de projeção */}
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <div className="px-5 py-3.5 border-b border-oli-border">
              <h2 className="text-sm font-bold text-oli-dark">Detalhamento por mês</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider border-b border-oli-border">
                    <th className="text-left px-5 py-3">Mês</th>
                    <th className="text-right px-4 py-3">Mensal</th>
                    <th className="text-right px-4 py-3">Anual prov.</th>
                    <th className="text-right px-4 py-3">Total projetado</th>
                    <th className="text-left px-4 py-3">Assinaturas ativas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-oli-border">
                  {projections.map(p => {
                    const isCurrent = p.year === nowSP.getFullYear() && p.month === nowSP.getMonth();
                    return (
                      <tr key={`${p.year}-${p.month}`} className={`hover:bg-oli-bg/60 ${isCurrent ? 'bg-oli-green/5' : ''}`}>
                        <td className="px-5 py-3 text-[12px] font-semibold text-oli-dark">
                          {monthLabel(p.year, p.month)}
                          {isCurrent && <span className="ml-2 text-[9px] bg-oli-green text-white px-1.5 py-0.5 rounded-full">Atual</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] text-oli-dark">{fmtBRL(p.mensal)}</td>
                        <td className="px-4 py-3 text-right text-[12px] text-oli-gold font-semibold">{fmtBRL(p.anual)}</td>
                        <td className="px-4 py-3 text-right text-[12px] font-extrabold text-oli-dark">{fmtBRL(p.total)}</td>
                        <td className="px-4 py-3 text-[11px] text-oli-lgray">{p.breakdown.length} assinaturas</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalhamento dos planos ativos */}
          {projAtual && projAtual.breakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-oli-border">
                <h2 className="text-sm font-bold text-oli-dark">Assinaturas ativas — {mLabel}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider border-b border-oli-border">
                      <th className="text-left px-5 py-3">Médico</th>
                      <th className="text-left px-4 py-3">Plano</th>
                      <th className="text-left px-4 py-3">Ciclo</th>
                      <th className="text-right px-4 py-3">Provisão mensal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-oli-border">
                    {projAtual.breakdown
                      .sort((a, b) => b.valor - a.valor)
                      .map((b, i) => (
                        <tr key={i} className="hover:bg-oli-bg/60">
                          <td className="px-5 py-3 text-[12px] font-semibold text-oli-dark">{b.medicoNome}</td>
                          <td className="px-4 py-3 text-[12px] text-oli-dark">{b.nome}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.ciclo.includes('anual') || b.ciclo === 'yearly' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                              {CYCLE_MAP[b.ciclo.toUpperCase()] ?? b.ciclo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[12px] font-bold text-oli-dark">{fmtBRL(b.valor)}</td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-oli-border bg-oli-bg/50">
                      <td colSpan={3} className="px-5 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                        Total provisionado em {mLabel}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-sm text-oli-dark">
                        {fmtBRL(projAtual.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: A PAGAR (manual)
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'pagar' && (
        <div className="space-y-4">

          {/* Form novo lançamento */}
          <div className="bg-white rounded-2xl border border-oli-border p-6">
            <h2 className="text-sm font-bold text-oli-dark mb-4">Novo lançamento</h2>
            <form action={upsertFinancialEntry} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-5 gap-y-4">
              <div className="flex flex-col gap-1.5 xl:col-span-2">
                <label className="block text-sm font-semibold text-oli-dark">Descrição *</label>
                <input name="descricao" required placeholder="Ex: Conta de luz, Limpeza..."
                  className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-semibold text-oli-dark">Valor *</label>
                <input name="valor" type="number" step="0.01" min="0" required placeholder="0,00"
                  className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-semibold text-oli-dark">Vencimento *</label>
                <input name="vencimento" type="date" required defaultValue={todayISO}
                  className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-semibold text-oli-dark">Fornecedor</label>
                <select name="supplier_id"
                  className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors">
                  <option value="">Nenhum</option>
                  {(suppliers ?? []).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-semibold text-oli-dark">Categoria</label>
                <input name="categoria" placeholder="Ex: Utilidades, RH..."
                  className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors" />
              </div>
              <input type="hidden" name="tipo"       value="pagar" />
              <input type="hidden" name="status"     value="pendente" />
              <input type="hidden" name="recorrente" value="false" />
              <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                <button type="submit"
                  className="bg-oli-green text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-[#4a6454] transition-colors">
                  Lançar
                </button>
              </div>
            </form>
          </div>

          {/* Tabela do mês */}
          {(payEntries ?? []).length > 0 ? (
            <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-oli-border">
                <h2 className="text-sm font-bold text-oli-dark">Contas a pagar — {mLabel}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider border-b border-oli-border">
                      <th className="text-left px-5 py-3">Descrição</th>
                      <th className="text-left px-4 py-3">Fornecedor</th>
                      <th className="text-left px-4 py-3">Vencimento</th>
                      <th className="text-right px-4 py-3">Valor</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-oli-border">
                    {(payEntries as unknown as FinEntry[]).map(e => {
                      const vencido = e.vencimento < todayISO && e.status === 'pendente';
                      const statusMap: Record<string, { label: string; cls: string }> = {
                        pendente:  { label: 'Pendente',  cls: 'bg-yellow-50 text-yellow-700' },
                        pago:      { label: 'Pago',      cls: 'bg-green-50 text-green-700' },
                        vencido:   { label: 'Vencido',   cls: 'bg-red-50 text-red-700' },
                        cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
                      };
                      const st = statusMap[e.status] ?? { label: e.status, cls: 'bg-gray-100 text-gray-500' };
                      return (
                        <tr key={e.id} className="hover:bg-oli-bg/60">
                          <td className="px-5 py-3">
                            <p className="text-[12px] font-semibold text-oli-dark">{e.descricao}</p>
                            {e.categoria && <p className="text-[11px] text-oli-lgray">{e.categoria}</p>}
                          </td>
                          <td className="px-4 py-3 text-[12px] text-oli-lgray">
                            {(e.suppliers as { nome: string } | null)?.nome ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-[12px] whitespace-nowrap">
                            <span className={vencido ? 'font-bold text-red-600' : 'text-oli-dark'}>
                              {fmtDate(e.vencimento)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-sm text-red-600">
                            −{fmtBRL(e.valor)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {e.status === 'pendente' && (
                                <form action={markEntryPaid}>
                                  <input type="hidden" name="id"      value={e.id} />
                                  <input type="hidden" name="pago_em" value={todayISO} />
                                  <button type="submit" className="text-[10px] font-bold text-oli-green hover:underline">Pagar</button>
                                </form>
                              )}
                              {e.status !== 'cancelado' && e.status !== 'pago' && (
                                <form action={cancelEntry}>
                                  <input type="hidden" name="id" value={e.id} />
                                  <button type="submit" className="text-[10px] text-oli-lgray hover:text-oli-red hover:underline">Cancelar</button>
                                </form>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-oli-border bg-oli-bg/50">
                      <td colSpan={3} className="px-5 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                        Total a pagar
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-sm text-red-600">
                        −{fmtBRL(totalPagar)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-oli-border flex flex-col items-center justify-center py-12 text-oli-lgray">
              <p className="text-sm font-semibold">Sem contas a pagar em {mLabel}</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
