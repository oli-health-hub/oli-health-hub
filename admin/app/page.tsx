import type React from 'react';
import {
  DollarSign, Calendar, Building2, Stethoscope, Clock,
  TrendingUp, CalendarCheck, Target, UserPlus, Leaf, CalendarX,
  Repeat, Wallet,
} from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ─── Asaas Summary fetch ──────────────────────────────────────────────────────
interface AsaasSummary {
  balance:            number;
  mrr:                number;
  paymentsMonth:      number;
  paymentsLastMonth:  number;
  activeSubsCount:    number;
}

async function fetchAsaasSummary(): Promise<AsaasSummary | null> {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xwcarrurjvfxisuaihid.supabase.co'}/functions/v1/admin-asaas-summary`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    return await res.json() as AsaasSummary;
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtDelta(pct: number) {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function getDeltaColor(pct: number) {
  if (pct > 0) return 'text-emerald-600';
  if (pct < 0) return 'text-red-500';
  return 'text-oli-lgray';
}

function pct(a: number, b: number) {
  if (b === 0) return a > 0 ? 100 : 0;
  return ((a - b) / b) * 100;
}

// ─── Donut CSS ────────────────────────────────────────────────────────────────
// Gera conic-gradient para donut chart puro CSS

const ROOM_COLORS = [
  '#5F7D67', '#B8893C', '#7A9E7E', '#D4A853', '#4a6454',
  '#9B9B9B', '#2F2F2F',
];

function buildConic(segments: number[]) {
  const total = segments.reduce((a, b) => a + b, 0);
  if (total === 0) return 'conic-gradient(#E0D8D0 0deg 360deg)';
  let deg = 0;
  const parts = segments.map((v, i) => {
    const angle = (v / total) * 360;
    const part = `${ROOM_COLORS[i % ROOM_COLORS.length]} ${deg}deg ${deg + angle}deg`;
    deg += angle;
    return part;
  });
  return `conic-gradient(${parts.join(', ')})`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, delta, icon, iconBg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-oli-border p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        {delta !== undefined && (
          <span className={`text-[11px] font-bold ${getDeltaColor(delta)}`}>
            {fmtDelta(delta)} ontem
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-oli-dark leading-none">{value}</p>
        <p className="text-[11px] font-semibold text-oli-lgray uppercase tracking-wider mt-1.5">{label}</p>
        {sub && <p className="text-[11px] text-oli-lgray mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    // valores do DB (português)
    em_atendimento: { label: 'Em sessão',    cls: 'bg-emerald-50 text-emerald-700' },
    aguardando:     { label: 'Aguardando',   cls: 'bg-sky-50 text-sky-700' },
    agendado:       { label: 'Agendada',     cls: 'bg-blue-50 text-blue-700' },
    atendido:       { label: 'Concluída',    cls: 'bg-gray-100 text-gray-500' },
    nao_compareceu: { label: 'No-show',      cls: 'bg-orange-50 text-orange-600' },
    // legado inglês (compatibilidade)
    active:         { label: 'Em sessão',    cls: 'bg-emerald-50 text-emerald-700' },
    scheduled:      { label: 'Agendada',     cls: 'bg-blue-50 text-blue-700' },
    completed:      { label: 'Concluída',    cls: 'bg-gray-100 text-gray-500' },
    cancelled:      { label: 'Cancelada',    cls: 'bg-red-50 text-red-600' },
    no_show:        { label: 'No-show',      cls: 'bg-orange-50 text-orange-600' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createSupabaseServer();

  const SP = 'America/Sao_Paulo';
  const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));

  const todayStart = new Date(nowSP); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(nowSP); todayEnd.setHours(23, 59, 59, 999);

  const ystStart = new Date(todayStart); ystStart.setDate(ystStart.getDate() - 1);
  const ystEnd   = new Date(todayEnd);   ystEnd.setDate(ystEnd.getDate() - 1);

  const monthStart = new Date(nowSP); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const lastMonthStart = new Date(monthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthEnd   = new Date(monthStart); lastMonthEnd.setSeconds(-1);

  const [
    { count: totalMedicos },
    { count: novosHoje },
    { data: reservasHoje },
    { data: ystReservas },
    { data: activeNow },
    { data: proximaRes },
    { data: receitaHoje },
    { data: receitaYst },
    { data: reservasMes },
    { data: receitaMes },
    { data: receitaLastMes },
    { data: todasReservasHoje },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).not('user_type', 'in', '(admin,founder,specialist,partner)'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase.from('reservations').select('id, status').gte('start_time', todayStart.toISOString()).lte('start_time', todayEnd.toISOString()).not('status', 'in', '("nao_compareceu")'),
    supabase.from('reservations').select('id').gte('start_time', ystStart.toISOString()).lte('start_time', ystEnd.toISOString()).not('status', 'in', '("nao_compareceu")'),
    supabase.from('reservations').select('id, room_name, status').lte('start_time', nowSP.toISOString()).gte('end_time', nowSP.toISOString()).eq('status', 'em_atendimento'),
    supabase.from('reservations').select('start_time, room_name, profiles(nome)').gt('start_time', nowSP.toISOString()).not('status', 'in', '("cancelled","no_show")').order('start_time', { ascending: true }).limit(1),
    supabase.from('usage_charges').select('valor_total').gte('iniciado_em', todayStart.toISOString()).lte('iniciado_em', todayEnd.toISOString()),
    supabase.from('usage_charges').select('valor_total').gte('iniciado_em', ystStart.toISOString()).lte('iniciado_em', ystEnd.toISOString()),
    supabase.from('reservations').select('id', { count: 'exact' }).gte('start_time', monthStart.toISOString()).not('status', 'in', '("cancelled","no_show")'),
    supabase.from('usage_charges').select('valor_total').gte('iniciado_em', monthStart.toISOString()),
    supabase.from('usage_charges').select('valor_total').gte('iniciado_em', lastMonthStart.toISOString()).lte('iniciado_em', lastMonthEnd.toISOString()),
    supabase.from('reservations').select('id, room_name, status, start_time, end_time, profiles(nome)').gte('start_time', todayStart.toISOString()).lte('start_time', todayEnd.toISOString()).order('start_time', { ascending: true }).limit(20),
  ]);

  // ── Dados reais do Asaas (saldo + MRR real + recebido mês) ──────────────────
  const asaasSummary = await fetchAsaasSummary();

  // ── MRR estimado (DB subscriptions) — fallback caso Asaas falhe ──────────
  const { data: activeSubs } = await supabase
    .from('subscriptions')
    .select('ciclo, plans(name, preco_mensal, preco_anual)')
    .eq('status', 'active');

  type SubRow = { ciclo: string; plans: { name: string; preco_mensal: number; preco_anual: number } | { name: string; preco_mensal: number; preco_anual: number }[] | null };

  let mrrTotal = 0;
  const planCounts: Record<string, number> = { START: 0, BASE: 0, PRO: 0, VIP: 0 };
  (activeSubs as SubRow[] ?? []).forEach(s => {
    const planRaw = s.plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    if (!plan) return;
    planCounts[plan.name] = (planCounts[plan.name] ?? 0) + 1;
    // MRR: mensal contribui preco_mensal, anual contribui preco_anual/12
    if (s.ciclo === 'mensal') mrrTotal += Number(plan.preco_mensal ?? 0);
    else if (s.ciclo === 'anual') mrrTotal += Number(plan.preco_anual ?? 0) / 12;
  });

  // ── Cálculos ─────────────────────────────────────────────────────────────────

  const salaEmUso     = activeNow?.length ?? 0;
  const totalHoje     = reservasHoje?.length ?? 0;
  const totalYst      = ystReservas?.length ?? 0;
  const receitaHojeV  = (receitaHoje ?? []).reduce((s, r) => s + (r.valor_total ?? 0), 0);
  const receitaYstV   = (receitaYst ?? []).reduce((s, r) => s + (r.valor_total ?? 0), 0);
  const receitaMesV   = (receitaMes ?? []).reduce((s, r) => s + (r.valor_total ?? 0), 0);
  const receitaLastV  = (receitaLastMes ?? []).reduce((s, r) => s + (r.valor_total ?? 0), 0);
  const reservasMesN  = reservasMes?.length ?? 0;

  const proxRes = proximaRes?.[0];
  const proxMins = proxRes ? Math.max(0, Math.floor((new Date(proxRes.start_time).getTime() - Date.now()) / 60000)) : null;
  const proxProfile = proxRes?.profiles as { nome: string } | null | undefined;

  // Reservas por sala (para donut)
  const roomCounts: Record<string, number> = {};
  (todasReservasHoje ?? []).forEach(r => {
    roomCounts[r.room_name] = (roomCounts[r.room_name] ?? 0) + 1;
  });
  const roomRanking = Object.entries(roomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  const totalRoomRes = roomRanking.reduce((s, [, v]) => s + v, 0);
  const donutGradient = buildConic(roomRanking.map(([, v]) => v));

  // Reservas ativas/agendadas/concluídas hoje
  const statusCounts = { em_atendimento: 0, aguardando: 0, agendado: 0, atendido: 0, nao_compareceu: 0 };
  (reservasHoje ?? []).forEach(r => { (statusCounts as Record<string, number>)[r.status] = ((statusCounts as Record<string, number>)[r.status] ?? 0) + 1; });

  const dateFormatted = nowSP.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase());
  const timeFormatted = nowSP.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hour = nowSP.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="p-6 space-y-6 bg-oli-bg min-h-screen">

      {/* ── Top bar ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-oli-dark tracking-tight">
            {greeting}, Administrador!
          </h1>
          <p className="text-sm text-oli-lgray mt-0.5">
            {dateFormatted} · {timeFormatted} · Aqui está o resumo do OLI Health Hub hoje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Tempo real
          </div>
        </div>
      </div>

      {/* ── Hero Financeiro: Asaas Real + MRR breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Saldo Asaas */}
        <div className="bg-white rounded-2xl border border-oli-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#EFF4F0' }}>
              <Wallet size={18} color="#5F7D67" />
            </div>
            <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Saldo Asaas</p>
          </div>
          <p className="text-2xl font-extrabold text-oli-dark leading-none">
            {asaasSummary ? fmtBRL(asaasSummary.balance) : '—'}
          </p>
          <p className="text-[11px] text-oli-lgray mt-1">
            {asaasSummary ? 'disponível para saque' : 'API indisponível'}
          </p>
        </div>

        {/* Recebido este mês */}
        <div className="bg-white rounded-2xl border border-oli-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFF7ED' }}>
              <DollarSign size={18} color="#f97316" />
            </div>
            <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Recebido no mês</p>
          </div>
          <p className="text-2xl font-extrabold text-oli-dark leading-none">
            {asaasSummary ? fmtBRL(asaasSummary.paymentsMonth) : '—'}
          </p>
          {asaasSummary && asaasSummary.paymentsLastMonth > 0 && (
            <p className={`text-[11px] font-semibold mt-1 ${getDeltaColor(pct(asaasSummary.paymentsMonth, asaasSummary.paymentsLastMonth))}`}>
              {fmtDelta(pct(asaasSummary.paymentsMonth, asaasSummary.paymentsLastMonth))} vs mês passado
            </p>
          )}
        </div>

        {/* MRR Asaas */}
        <div className="bg-white rounded-2xl border border-oli-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#EFF6FF' }}>
              <Repeat size={18} color="#3b82f6" />
            </div>
            <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">MRR Asaas</p>
          </div>
          <p className="text-2xl font-extrabold text-oli-dark leading-none">
            {asaasSummary ? fmtBRL(asaasSummary.mrr) : fmtBRL(mrrTotal)}
          </p>
          <p className="text-[11px] text-oli-lgray mt-1">
            {asaasSummary
              ? `${asaasSummary.activeSubsCount} assinaturas`
              : `${(activeSubs ?? []).length} estimado (DB)`}
          </p>
        </div>
      </div>

      {/* ── Breakdown por plano ── */}
      <div className="bg-white rounded-2xl border border-oli-border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider">Distribuição por plano</p>
            <p className="text-sm text-oli-dark mt-1">{(activeSubs ?? []).length} médicos ativos</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['START','BASE','PRO','VIP'] as const).map(name => {
              const colorMap: Record<string,string> = {
                START: 'bg-stone-100 text-stone-700',
                BASE:  'bg-emerald-50 text-emerald-700',
                PRO:   'bg-amber-50 text-amber-700',
                VIP:   'bg-violet-50 text-violet-700',
              };
              return (
                <div key={name} className={`rounded-xl px-3 py-2 ${colorMap[name]}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{name}</p>
                  <p className="text-lg font-extrabold leading-none mt-0.5">{planCounts[name] ?? 0}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={<DollarSign size={18} color="#3b82f6" />} iconBg="#EFF6FF"
          label="Receita hoje" value={receitaHojeV > 0 ? fmtBRL(receitaHojeV) : '—'}
          sub="minutagem cobrada"
          delta={receitaYstV > 0 || receitaHojeV > 0 ? pct(receitaHojeV, receitaYstV) : undefined}
        />
        <KpiCard
          icon={<Calendar size={18} color="#5F7D67" />} iconBg="#F0FDF4"
          label="Reservas hoje" value={totalHoje}
          sub={`${statusCounts.em_atendimento} em sessão · ${statusCounts.atendido} concluídas`}
          delta={pct(totalHoje, totalYst)}
        />
        <KpiCard
          icon={<Building2 size={18} color="#f97316" />} iconBg="#FFF7ED"
          label="Salas em uso" value={`${salaEmUso}/7`}
          sub={salaEmUso > 0 ? 'Sessões ativas agora' : 'Nenhuma sessão ativa'}
        />
        <KpiCard
          icon={<Stethoscope size={18} color="#a855f7" />} iconBg="#FAF5FF"
          label="Médicos" value={totalMedicos ?? 0}
          sub={(novosHoje ?? 0) > 0 ? `+${novosHoje} novo(s) hoje` : 'cadastrados'}
        />
        <KpiCard
          icon={<Clock size={18} color="#d97706" />} iconBg="#FEF3C7"
          label="Próxima reserva"
          value={proxMins !== null ? (proxMins < 60 ? `${proxMins} min` : `${Math.floor(proxMins / 60)}h${proxMins % 60}m`) : '—'}
          sub={proxRes ? `${proxProfile?.nome ?? '—'} · ${proxRes.room_name}` : 'Sem reservas agendadas'}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Status do dia */}
        <div className="bg-white rounded-2xl border border-oli-border p-5">
          <h2 className="text-sm font-bold text-oli-dark mb-4">Reservas do dia — Status</h2>
          <div className="space-y-3">
            {[
              { key: 'em_atendimento', label: 'Em sessão',   color: '#10b981' },
              { key: 'aguardando',     label: 'Aguardando',  color: '#0ea5e9' },
              { key: 'agendado',       label: 'Agendadas',   color: '#3b82f6' },
              { key: 'atendido',       label: 'Concluídas',  color: '#5F7D67' },
              { key: 'nao_compareceu', label: 'No-show',     color: '#f97316' },
            ].map(({ key, label, color }) => {
              const count = (statusCounts as Record<string, number>)[key] ?? 0;
              const barPct = totalHoje > 0 ? (count / totalHoje) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-oli-dark">{label}</span>
                    <span className="text-[12px] font-bold text-oli-lgray">{count}</span>
                  </div>
                  <div className="h-2 bg-oli-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barPct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {totalHoje === 0 && (
            <p className="text-center text-oli-lgray text-sm mt-6">Sem reservas hoje</p>
          )}
        </div>

        {/* Donut — Reservas por sala */}
        <div className="bg-white rounded-2xl border border-oli-border p-5">
          <h2 className="text-sm font-bold text-oli-dark mb-4">Reservas por sala (hoje)</h2>
          {totalRoomRes > 0 ? (
            <div className="flex items-center gap-5">
              {/* Donut */}
              <div className="relative shrink-0">
                <div
                  className="w-24 h-24 rounded-full"
                  style={{ background: donutGradient }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-14 h-14 rounded-full bg-white flex items-center justify-center"
                  >
                    <span className="text-lg font-extrabold text-oli-dark">{totalRoomRes}</span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-1.5">
                {roomRanking.map(([room, count], i) => (
                  <div key={room} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: ROOM_COLORS[i % ROOM_COLORS.length] }}
                    />
                    <span className="text-[11px] text-oli-dark font-medium flex-1 truncate">{room}</span>
                    <span className="text-[11px] font-bold text-oli-lgray">{((count / totalRoomRes) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-oli-lgray">
              <Building2 size={32} className="mb-2 opacity-40" />
              <p className="text-sm">Sem reservas hoje</p>
            </div>
          )}
        </div>

        {/* Ranking salas */}
        <div className="bg-white rounded-2xl border border-oli-border p-5">
          <h2 className="text-sm font-bold text-oli-dark mb-4">Salas mais utilizadas</h2>
          {roomRanking.length > 0 ? (
            <div className="space-y-2.5">
              {roomRanking.map(([room, count], i) => (
                <div key={room} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-oli-border text-[10px] font-bold text-oli-lgray flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ background: ROOM_COLORS[i % ROOM_COLORS.length] }}
                  />
                  <span className="flex-1 text-[12px] font-semibold text-oli-dark truncate">{room}</span>
                  <span className="text-sm font-extrabold text-oli-dark">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-oli-lgray text-sm mt-8">Sem dados hoje</p>
          )}
        </div>
      </div>

      {/* ── Reservas em andamento + Receita ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Reservas em andamento — 2 colunas */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-oli-border">
            <h2 className="text-sm font-bold text-oli-dark">Reservas do dia</h2>
            <span className="text-[10px] text-oli-lgray">{(todasReservasHoje ?? []).length} reservas</span>
          </div>
          {(todasReservasHoje ?? []).length > 0 ? (
            <div className="divide-y divide-oli-border">
              {(todasReservasHoje ?? []).slice(0, 8).map((r) => {
                const profRaw = r.profiles as { nome: string } | { nome: string }[] | null;
                const prof = Array.isArray(profRaw) ? profRaw[0] ?? null : profRaw;
                const startTime = new Date(r.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP });
                const endTime   = new Date(r.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP });
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="text-center shrink-0 w-12">
                      <p className="text-[11px] font-bold text-oli-dark">{startTime}</p>
                      <p className="text-[10px] text-oli-lgray">{endTime}</p>
                    </div>
                    <div className="w-px h-8 bg-oli-border shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-oli-dark truncate">{prof?.nome ?? '—'}</p>
                      <p className="text-[11px] text-oli-lgray">{r.room_name}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-oli-lgray">
              <CalendarX size={36} className="mb-3 opacity-40" />
              <p className="text-sm font-semibold">Sem reservas para hoje</p>
            </div>
          )}
        </div>

        {/* Receita — resumo */}
        <div className="bg-white rounded-2xl border border-oli-border p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-oli-dark">Receita</h2>

          <div className="space-y-3">
            <div className="bg-oli-bg rounded-xl p-3.5">
              <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Hoje</p>
              <p className="text-2xl font-extrabold text-oli-dark">{receitaHojeV > 0 ? fmtBRL(receitaHojeV) : '—'}</p>
              {receitaYstV > 0 && (
                <p className={`text-[11px] font-semibold mt-1 ${getDeltaColor(pct(receitaHojeV, receitaYstV))}`}>
                  {fmtDelta(pct(receitaHojeV, receitaYstV))} vs ontem ({fmtBRL(receitaYstV)})
                </p>
              )}
            </div>

            <div className="bg-oli-bg rounded-xl p-3.5">
              <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mb-1">Este mês</p>
              <p className="text-2xl font-extrabold text-oli-dark">{receitaMesV > 0 ? fmtBRL(receitaMesV) : '—'}</p>
              {receitaLastV > 0 && (
                <p className={`text-[11px] font-semibold mt-1 ${getDeltaColor(pct(receitaMesV, receitaLastV))}`}>
                  {fmtDelta(pct(receitaMesV, receitaLastV))} vs mês passado
                </p>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="border-t border-oli-border pt-3 space-y-2">
            <div className="flex justify-between text-[12px]">
              <span className="text-oli-lgray font-medium">Reservas este mês</span>
              <span className="font-bold text-oli-dark">{reservasMesN}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-oli-lgray font-medium">Ticket médio</span>
              <span className="font-bold text-oli-dark">
                {reservasMesN > 0 ? fmtBRL(receitaMesV / reservasMesN) : '—'}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-oli-lgray font-medium">Médicos ativos</span>
              <span className="font-bold text-oli-dark">{totalMedicos ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Resumo do mês ── */}
      <div className="bg-white rounded-2xl border border-oli-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-oli-dark">Resumo do mês</h2>
          <span className="text-[10px] text-oli-lgray font-medium">
            {nowSP.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            {
              label: 'Receita total', icon: <TrendingUp size={16} color="#3b82f6" />, iconBg: '#EFF6FF',
              value: receitaMesV > 0 ? fmtBRL(receitaMesV) : '—',
              delta: receitaLastV > 0 ? pct(receitaMesV, receitaLastV) : undefined,
              sub: 'vs mês passado',
            },
            {
              label: 'Reservas', icon: <CalendarCheck size={16} color="#5F7D67" />, iconBg: '#F0FDF4',
              value: reservasMesN,
              sub: 'este mês',
            },
            {
              label: 'Ticket médio', icon: <Target size={16} color="#f97316" />, iconBg: '#FFF7ED',
              value: reservasMesN > 0 ? fmtBRL(receitaMesV / reservasMesN) : '—',
              sub: 'por reserva',
            },
            {
              label: 'Novos médicos', icon: <UserPlus size={16} color="#a855f7" />, iconBg: '#FAF5FF',
              value: novosHoje ?? 0,
              sub: 'cadastrados hoje',
            },
          ] as { label: string; icon: React.ReactNode; iconBg: string; value: string | number; delta?: number; sub: string }[]).map(({ label, icon, iconBg, value, delta, sub }) => (
            <div key={label} className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: iconBg }}
              >
                {icon}
              </div>
              <div>
                <p className="text-lg font-extrabold text-oli-dark leading-none">{value}</p>
                <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider mt-1">{label}</p>
                {delta !== undefined ? (
                  <p className={`text-[10px] font-semibold mt-0.5 ${getDeltaColor(delta)}`}>
                    {fmtDelta(delta)} {sub}
                  </p>
                ) : (
                  <p className="text-[10px] text-oli-lgray mt-0.5">{sub}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dica do dia ── */}
      <div
        className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: 'linear-gradient(135deg, #5F7D67 0%, #4a6454 100%)' }}
      >
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Leaf size={20} color="white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm">Dica operacional</p>
          <p className="text-white/70 text-[12px] mt-0.5 leading-relaxed">
            Médicos com <strong className="text-white">saldo de horas zerado</strong> não conseguem iniciar sessões.
            Verifique em <a href="/horas" className="text-white underline">Horas</a> quem está próximo do limite para agir proativamente.
          </p>
        </div>
      </div>

    </div>
  );
}
