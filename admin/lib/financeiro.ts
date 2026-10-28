/**
 * Consolidação financeira do painel admin (aba Financeiro).
 *
 * Separa de propósito quatro coisas que o painel antigo misturava:
 *   - RECEBIDO   — o cliente pagou no mês (Asaas RECEIVED/CONFIRMED/RECEIVED_IN_CASH + dinheiro registrado)
 *   - DISPONÍVEL — saldo da conta Asaas, pronto para saque
 *   - A LIBERAR  — cartão confirmado que ainda não caiu no saldo (Asaas CONFIRMED)
 *   - A RECEBER  — cobranças emitidas e ainda não pagas (PENDING) e vencidas (OVERDUE)
 * Minutagem de sessões (usage_charges) é consumo apurado, não entrada de caixa:
 * fica à parte e nunca entra na soma do recebido.
 */

import { createSupabaseAdmin } from '@/lib/supabase-server';
import {
  getAllPayments,
  getAllActiveSubscriptions,
  getBalance,
  cycleToMonthlyFactor,
  AsaasNotConfiguredError,
  BILLING_TYPE_MAP,
  type AsaasPayment,
} from '@/lib/asaas';

const SP = 'America/Sao_Paulo';

export type OrigemPagamento = 'Plano' | 'Módulo' | 'Pacote de horas' | 'Avulso';

export interface Valores {
  bruto:   number;
  taxas:   number;
  liquido: number;
  count:   number;
}

export interface LinhaPagamento {
  id:        string;
  data:      string;           // YYYY-MM-DD (pagamento ou vencimento)
  cliente:   string;
  origem:    OrigemPagamento;
  forma:     string;
  status:    string;
  bruto:     number;
  liquido:   number;
}

export interface Agrupamento {
  chave: string;
  bruto: number;
  count: number;
}

export interface FinanceiroMes {
  mes:         string;         // YYYY-MM
  mesAnterior: string;
  hoje:        string;         // YYYY-MM-DD (São Paulo)
  mesEhAtual:  boolean;

  asaasOk:     boolean;
  avisos:      string[];

  // Posição atual (independe do mês selecionado)
  saldoDisponivel: number | null;
  aLiberar:        Valores;
  aReceber:        { total: number; count: number; vencemNoMesAtual: number };
  vencido:         { total: number; count: number };
  mrr:             number;
  assinaturasPagas: number;

  // Mês selecionado
  asaasMes:         Valores;
  asaasMesAnterior: Valores;
  estornadoMes:     { total: number; count: number };
  dinheiroMes:      { total: number; count: number };
  dinheiroMesAnterior: number;
  porForma:         Agrupamento[];
  porOrigem:        Agrupamento[];
  recebimentos:     LinhaPagamento[];
  emAberto:         LinhaPagamento[];

  // Consumo (não é caixa)
  minutagemMes:     number;
  minutagemSessoes: number;
  reservasMes:      number;
}

const vazio = (): Valores => ({ bruto: 0, taxas: 0, liquido: 0, count: 0 });

function somar(v: Valores, p: AsaasPayment): Valores {
  const bruto   = Number(p.value ?? 0);
  const liquido = Number(p.netValue ?? p.value ?? 0);
  return { bruto: v.bruto + bruto, liquido: v.liquido + liquido, taxas: v.taxas + (bruto - liquido), count: v.count + 1 };
}

export function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: SP });
}

export function ultimoDiaDoMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

export function deslocarMes(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function mesValido(v: string | undefined): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

const RECEBIDO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

interface Referencia { tipo: string | null; userId: string | null }

/** externalReference do app: "tipo::userId::..." (subscription, module, hour_package). */
function lerReferencia(ref: string | null): Referencia {
  if (!ref) return { tipo: null, userId: null };
  const [tipo, userId] = ref.split('::');
  return { tipo: tipo || null, userId: userId || null };
}

function classificarOrigem(p: AsaasPayment, ref: Referencia): OrigemPagamento {
  if (ref.tipo === 'subscription' || p.subscription) return 'Plano';
  if (ref.tipo === 'module')       return 'Módulo';
  if (ref.tipo === 'hour_package') return 'Pacote de horas';
  return 'Avulso';
}

export async function carregarFinanceiro(mes: string): Promise<FinanceiroMes> {
  const hoje        = hojeSP();
  const mesAtual    = hoje.slice(0, 7);
  const mesAnterior = deslocarMes(mes, -1);
  const inicioMes   = `${mes}-01`;
  const fimMes      = ultimoDiaDoMes(mes);
  const inicioAnt   = `${mesAnterior}-01`;
  const supabase    = await createSupabaseAdmin();

  const avisos: string[] = [];
  let asaasOk = true;

  async function tentar<T>(rotulo: string, fn: () => Promise<T>, padrao: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      asaasOk = false;
      avisos.push(
        err instanceof AsaasNotConfiguredError
          ? 'ASAAS_API_KEY não configurada no admin.'
          : `${rotulo}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return padrao;
    }
  }

  const [
    saldo, pagosPeriodo, confirmados, pendentes, vencidos, assinaturas,
    dinheiroRes, minutagemRes, reservasRes,
  ] = await Promise.all([
    tentar('Saldo', async () => (await getBalance()).balance, null as number | null),
    tentar('Pagamentos do período', () => getAllPayments({ 'paymentDate[ge]': inicioAnt, 'paymentDate[le]': fimMes }), [] as AsaasPayment[]),
    tentar('Cartões a liberar', () => getAllPayments({ status: 'CONFIRMED' }), [] as AsaasPayment[]),
    tentar('Cobranças pendentes', () => getAllPayments({ status: 'PENDING' }), [] as AsaasPayment[]),
    tentar('Cobranças vencidas', () => getAllPayments({ status: 'OVERDUE' }), [] as AsaasPayment[]),
    tentar('Assinaturas', () => getAllActiveSubscriptions(), []),
    supabase.from('cash_receipts').select('valor, recebido_em').is('estornado_em', null).gte('recebido_em', inicioAnt).lte('recebido_em', fimMes),
    supabase.from('usage_charges').select('valor_total').gte('iniciado_em', `${inicioMes}T00:00:00-03:00`).lte('iniciado_em', `${fimMes}T23:59:59-03:00`),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .gte('start_time', `${inicioMes}T00:00:00-03:00`)
      .lte('start_time', `${fimMes}T23:59:59-03:00`)
      .not('status', 'in', '("cancelled","cancelado","no_show","nao_compareceu")'),
  ]);

  // ── Nomes: externalReference → profiles; fallback pela assinatura Asaas ───
  const todos = [...pagosPeriodo, ...pendentes, ...vencidos];
  const userIds = new Set<string>();
  const subIds  = new Set<string>();
  todos.forEach(p => {
    const { userId } = lerReferencia(p.externalReference);
    if (userId) userIds.add(userId);
    else if (p.subscription) subIds.add(p.subscription);
  });

  const nomePorUser: Record<string, string> = {};
  const nomePorSub:  Record<string, string> = {};
  if (userIds.size > 0) {
    const { data } = await supabase.from('profiles').select('id, nome').in('id', Array.from(userIds));
    (data ?? []).forEach(r => { nomePorUser[r.id as string] = (r.nome as string) ?? '—'; });
  }
  if (subIds.size > 0) {
    const { data } = await supabase
      .from('subscriptions')
      .select('asaas_id_plain, profiles(nome)')
      .in('asaas_id_plain', Array.from(subIds));
    (data ?? []).forEach(r => {
      const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      if (r.asaas_id_plain) nomePorSub[r.asaas_id_plain as string] = (prof as { nome: string } | null)?.nome ?? '—';
    });
  }

  function linha(p: AsaasPayment, data: string): LinhaPagamento {
    const ref = lerReferencia(p.externalReference);
    const cliente =
      (ref.userId && nomePorUser[ref.userId]) ||
      (p.subscription && nomePorSub[p.subscription]) ||
      p.description ||
      'Cliente fora do app';
    return {
      id:      p.id,
      data,
      cliente,
      origem:  classificarOrigem(p, ref),
      forma:   BILLING_TYPE_MAP[p.billingType] ?? p.billingType,
      status:  p.status,
      bruto:   Number(p.value ?? 0),
      liquido: Number(p.netValue ?? p.value ?? 0),
    };
  }

  // ── Recebido por mês (data do pagamento) ──────────────────────────────────
  let asaasMes = vazio();
  let asaasMesAnterior = vazio();
  const estornadoMes = { total: 0, count: 0 };
  const recebimentos: LinhaPagamento[] = [];
  const porForma:  Record<string, Agrupamento> = {};
  const porOrigem: Record<string, Agrupamento> = {};

  pagosPeriodo.forEach(p => {
    const dia = p.paymentDate ?? p.confirmedDate;
    if (!dia) return;
    const noMes = dia.slice(0, 7) === mes;
    const noAnt = dia.slice(0, 7) === mesAnterior;

    if (p.status === 'REFUNDED') {
      if (noMes) { estornadoMes.total += Number(p.value ?? 0); estornadoMes.count += 1; }
      return;
    }
    if (!RECEBIDO.has(p.status)) return;

    if (noAnt) asaasMesAnterior = somar(asaasMesAnterior, p);
    if (!noMes) return;

    asaasMes = somar(asaasMes, p);
    const l = linha(p, dia);
    recebimentos.push(l);
    const f = porForma[l.forma]   ?? { chave: l.forma,   bruto: 0, count: 0 };
    const o = porOrigem[l.origem] ?? { chave: l.origem, bruto: 0, count: 0 };
    f.bruto += l.bruto; f.count += 1; porForma[l.forma] = f;
    o.bruto += l.bruto; o.count += 1; porOrigem[l.origem] = o;
  });
  recebimentos.sort((a, b) => b.data.localeCompare(a.data));

  // ── Posição atual ─────────────────────────────────────────────────────────
  const aLiberar = confirmados.reduce(somar, vazio());

  const aReceberTotal = pendentes.reduce((s, p) => s + Number(p.value ?? 0), 0);
  const vencemNoMesAtual = pendentes
    .filter(p => p.dueDate.slice(0, 7) === mesAtual)
    .reduce((s, p) => s + Number(p.value ?? 0), 0);
  const vencidoTotal = vencidos.reduce((s, p) => s + Number(p.value ?? 0), 0);

  const emAberto = [
    ...vencidos.map(p => linha(p, p.dueDate)),
    ...pendentes.map(p => linha(p, p.dueDate)),
  ].sort((a, b) => a.data.localeCompare(b.data));

  // MRR: todos os ciclos normalizados para mês; só assinaturas que cobram de fato
  const pagas = assinaturas.filter(s => Number(s.value) > 0);
  const mrr = pagas.reduce((s, sub) => s + Number(sub.value) * cycleToMonthlyFactor(sub.cycle), 0);

  // ── Dinheiro (fora do Asaas) ──────────────────────────────────────────────
  const dinheiro = (dinheiroRes.data ?? []) as Array<{ valor: number; recebido_em: string }>;
  const doMes = dinheiro.filter(r => r.recebido_em.startsWith(mes));
  const dinheiroMes = { total: doMes.reduce((s, r) => s + Number(r.valor), 0), count: doMes.length };
  const dinheiroMesAnterior = dinheiro
    .filter(r => r.recebido_em.startsWith(mesAnterior))
    .reduce((s, r) => s + Number(r.valor), 0);

  const minutagem = (minutagemRes.data ?? []) as Array<{ valor_total: number | null }>;

  return {
    mes, mesAnterior, hoje, mesEhAtual: mes === mesAtual,
    asaasOk, avisos,
    saldoDisponivel: saldo,
    aLiberar,
    aReceber: { total: aReceberTotal, count: pendentes.length, vencemNoMesAtual },
    vencido:  { total: vencidoTotal,  count: vencidos.length },
    mrr,
    assinaturasPagas: pagas.length,
    asaasMes, asaasMesAnterior, estornadoMes, dinheiroMes, dinheiroMesAnterior,
    porForma:  Object.values(porForma).sort((a, b) => b.bruto - a.bruto),
    porOrigem: Object.values(porOrigem).sort((a, b) => b.bruto - a.bruto),
    recebimentos, emAberto,
    minutagemMes:     minutagem.reduce((s, r) => s + Number(r.valor_total ?? 0), 0),
    minutagemSessoes: minutagem.length,
    reservasMes:      reservasRes.count ?? 0,
  };
}
