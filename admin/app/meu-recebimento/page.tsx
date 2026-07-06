import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Página pessoal do founder — visão de salário + comissão por ocupação.
 * Acesso restrito por e-mail (não aparece na sidebar pra outros admins).
 */
const FOUNDER_EMAIL = 'guilherme.pasquetti@gmail.com';

const SP = 'America/Sao_Paulo';
const GRID_HOURS = 15; // mesma janela 07h-22h usada em /salas

/** Salário-base mensal. R$6.000 só passa a valer com contrato renovado (lembrete agendado p/ 05/09/2026). */
const SALARIO_ATE_AGO = 4000;
const SALARIO_A_PARTIR_SET = 6000;
const CONTRATO_RENOVADO = false;

/** Comissão em alíquota única (cliff): a faixa atingida pela ocupação do mês vale sobre TODO o faturamento. */
const FAIXAS_COMISSAO = [
  { min: 0,  rate: 0.08 },
  { min: 30, rate: 0.12 },
  { min: 60, rate: 0.15 },
] as const;

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function salarioBase(ano: number, mesIdx: number) {
  // mesIdx 0-based (0=jan). Setembro = 8.
  const isSetembroOuDepois = ano > 2026 || (ano === 2026 && mesIdx >= 8);
  if (isSetembroOuDepois && CONTRATO_RENOVADO) return SALARIO_A_PARTIR_SET;
  return SALARIO_ATE_AGO;
}

function faixaComissao(ocupacaoPct: number) {
  return [...FAIXAS_COMISSAO].reverse().find(f => ocupacaoPct >= f.min) ?? FAIXAS_COMISSAO[0];
}

export default async function MeuRecebimentoPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email !== FOUNDER_EMAIL) {
    notFound();
  }

  const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: SP }));
  const [defAno, defMes] = [nowSP.getFullYear(), nowSP.getMonth()];

  const mesParam = searchParams.mes; // formato YYYY-MM
  const [ano, mesIdx] = mesParam
    ? [parseInt(mesParam.slice(0, 4), 10), parseInt(mesParam.slice(5, 7), 10) - 1]
    : [defAno, defMes];

  const from = new Date(ano, mesIdx, 1);
  const to   = new Date(ano, mesIdx + 1, 0);
  const fromISO = new Date(from.toISOString().slice(0, 10) + 'T00:00:00-03:00').toISOString();
  const toISO   = new Date(to.toISOString().slice(0, 10)   + 'T23:59:59-03:00').toISOString();
  const daysInMonth = to.getDate();

  const [
    { data: usageRows },
    { data: subsRows },
    { data: modsRows },
    { data: roomRows },
    { data: reservations },
  ] = await Promise.all([
    supabase.from('usage_charges').select('valor_total').gte('iniciado_em', fromISO).lte('iniciado_em', toISO),
    supabase.from('subscriptions').select('status, ciclo, plans(preco_mensal, preco_anual)').in('status', ['active', 'ACTIVE']),
    supabase.from('user_modules').select('status, modules(valor)').in('status', ['active', 'ACTIVE']),
    supabase.from('rooms').select('id'),
    supabase.from('reservations').select('start_time, end_time').gte('start_time', fromISO).lte('start_time', toISO).not('status', 'in', '("cancelled")'),
  ]);

  const receitaMinutagem = (usageRows ?? []).reduce((s, r) => s + (r.valor_total ?? 0), 0);
  const receitaAssinaturas = (subsRows ?? []).reduce((s, sub) => {
    const plan = sub.plans as unknown as { preco_mensal: number; preco_anual: number } | null;
    const valor = sub.ciclo === 'YEARLY' ? (plan?.preco_anual ?? 0) : (plan?.preco_mensal ?? 0);
    return s + valor;
  }, 0);
  const receitaModulos = (modsRows ?? []).reduce((s, m) => {
    const mod = m.modules as unknown as { valor: number } | null;
    return s + (mod?.valor ?? 0);
  }, 0);
  const faturamentoTotal = receitaMinutagem + receitaAssinaturas + receitaModulos;

  const rooms = roomRows ?? [];
  const totalScheduledMin = (reservations ?? []).reduce((s, r) => {
    return s + (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000;
  }, 0);
  const maxMin = rooms.length * daysInMonth * GRID_HOURS * 60;
  const ocupacaoPct = maxMin > 0 ? Math.round((totalScheduledMin / maxMin) * 100 * 10) / 10 : 0;

  const faixa = faixaComissao(ocupacaoPct);
  const comissao = faturamentoTotal * faixa.rate;
  const salario = salarioBase(ano, mesIdx);
  const totalReceber = salario + comissao;

  const mesLabel = from.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());

  function mesUrl(offset: number) {
    const d = new Date(ano, mesIdx + offset, 1);
    return `/meu-recebimento?mes=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  return (
    <div className="p-7 space-y-6 max-w-4xl">

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Meu Recebimento</h1>
          <p className="text-sm text-oli-gray mt-0.5">{mesLabel} — só você vê essa página</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={mesUrl(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-oli-gray transition-colors text-lg">‹</Link>
          <Link href="/meu-recebimento" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors">Mês atual</Link>
          <Link href={mesUrl(1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-oli-gray transition-colors text-lg">›</Link>
        </div>
      </div>

      {/* Total a receber */}
      <div className="bg-white rounded-2xl border border-oli-green/30 p-6">
        <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Total a receber no mês</p>
        <p className="text-4xl font-extrabold text-oli-green leading-none mt-2">{fmtBRL(totalReceber)}</p>
        <p className="mt-2 text-xs text-oli-lgray">
          {fmtBRL(salario)} salário-base + {fmtBRL(comissao)} comissão ({(faixa.rate * 100).toFixed(0)}% sobre faturamento)
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Salário-base</p>
          <p className="text-xl font-extrabold text-oli-dark mt-1">{fmtBRL(salario)}</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Faturamento OLI</p>
          <p className="text-xl font-extrabold text-oli-dark mt-1">{fmtBRL(faturamentoTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Ocupação do mês</p>
          <p className="text-xl font-extrabold text-oli-dark mt-1">{ocupacaoPct}%</p>
        </div>
        <div className="bg-white rounded-xl border border-oli-border p-4">
          <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Alíquota aplicada</p>
          <p className="text-xl font-extrabold text-oli-green mt-1">{(faixa.rate * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Breakdown de faturamento */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="px-5 py-3 border-b border-oli-border">
          <h2 className="text-sm font-bold text-oli-dark">Composição do faturamento</h2>
        </div>
        <div className="divide-y divide-oli-border text-sm">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-oli-gray">Minutagem por sessão</span>
            <span className="font-semibold text-oli-dark">{fmtBRL(receitaMinutagem)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-oli-gray">Assinaturas ativas (BASE/PRO)</span>
            <span className="font-semibold text-oli-dark">{fmtBRL(receitaAssinaturas)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-oli-gray">Módulos ativos</span>
            <span className="font-semibold text-oli-dark">{fmtBRL(receitaModulos)}</span>
          </div>
        </div>
      </div>

      {/* Faixas de comissão */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <div className="px-5 py-3 border-b border-oli-border">
          <h2 className="text-sm font-bold text-oli-dark">Faixas de comissão por ocupação</h2>
        </div>
        <div className="divide-y divide-oli-border text-sm">
          {FAIXAS_COMISSAO.map((f, i) => {
            const next = FAIXAS_COMISSAO[i + 1];
            const atingida = faixa.min === f.min;
            return (
              <div key={f.min} className={`flex items-center justify-between px-5 py-3 ${atingida ? 'bg-oli-green/5' : ''}`}>
                <span className={atingida ? 'font-semibold text-oli-dark' : 'text-oli-gray'}>
                  {next ? `${f.min}% – ${next.min}% ocupação` : `Acima de ${f.min}% ocupação`}
                </span>
                <span className={atingida ? 'font-bold text-oli-green' : 'text-oli-gray'}>{(f.rate * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-oli-lgray">
        Assinaturas e módulos contam pelo status atual (não histórico do mês selecionado) — igual à página Financeiro.
        Ocupação = horas reservadas ÷ (salas × dias do mês × 15h), mesma métrica de Mapa do Dia.
        {!CONTRATO_RENOVADO && ' Salário sobe pra R$6.000 a partir de setembro/2026 quando o contrato for renovado (CONTRATO_RENOVADO em meu-recebimento/page.tsx).'}
      </p>
    </div>
  );
}
