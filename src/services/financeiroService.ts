/**
 * financeiroService.ts
 *
 * Busca dados reais do Supabase para a tela Financeiro e o widget de saldo
 * de horas no Dashboard.
 *
 * Fase atual: usage_charges e hour_balance já existem no banco.
 * subscriptions e plans também — mas sem Asaas ainda, status é 'pending'.
 */

import { supabase } from './supabase';

// ─── Extrato de minutagem ────────────────────────────────────────────────────

export interface UsageChargeRow {
  id:           string;
  iniciado_em:  string;
  encerrado_em: string;
  minutos:      number;
  taxa_min:     number;
  valor_total:  number;
  room_name?:   string;   // via JOIN com reservations + rooms
}

export interface UsageSummary {
  totalMinutos:  number;
  totalValor:    number;
  totalSessoes:  number;
  charges:       UsageChargeRow[];
}

/**
 * Busca o extrato de minutagem do mês atual (ou mês passado se não houver dados).
 * Faz join com reservations e rooms para exibir o nome da sala.
 */
export async function fetchUsageSummary(
  professionalId: string,
  year:  number,
  month: number,  // 1-based
): Promise<UsageSummary> {
  const start = new Date(year, month - 1, 1).toISOString();
  const end   = new Date(year, month, 1).toISOString();

  const { data, error } = await supabase
    .from('usage_charges')
    .select(`
      id,
      iniciado_em,
      encerrado_em,
      minutos,
      taxa_min,
      valor_total,
      reservations ( rooms ( name ) )
    `)
    .eq('professional_id', professionalId)
    .gte('iniciado_em', start)
    .lt('iniciado_em', end)
    .order('iniciado_em', { ascending: false });

  if (error) throw error;

  const charges: UsageChargeRow[] = (data ?? []).map((row: any) => ({
    id:           row.id,
    iniciado_em:  row.iniciado_em,
    encerrado_em: row.encerrado_em,
    minutos:      row.minutos,
    taxa_min:     row.taxa_min,
    valor_total:  row.valor_total,
    room_name:    row.reservations?.rooms?.name ?? undefined,
  }));

  const totalMinutos = charges.reduce((sum, c) => sum + c.minutos,    0);
  const totalValor   = charges.reduce((sum, c) => sum + c.valor_total, 0);

  return {
    totalMinutos,
    totalValor: parseFloat(totalValor.toFixed(2)),
    totalSessoes: charges.length,
    charges,
  };
}

// ─── Saldo de horas ──────────────────────────────────────────────────────────

export interface HourBalance {
  minutosTotal:  number;
  minutosUsados: number;
  minutosLivres: number;
  horasLivres:   number;   // minutosLivres / 60 (arredondado)
  expiraEm:      string | null;
  baixo:         boolean;  // < 120 minutos (2h)
}

const LOW_BALANCE_MINUTES = 120;  // 2h

/**
 * Busca o saldo de horas ativo do profissional.
 * Retorna null se não houver pacote de horas ativo.
 */
export async function fetchHourBalance(
  professionalId: string,
): Promise<HourBalance | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('hour_balance')
    .select('minutos_total, minutos_usados, expira_em')
    .eq('professional_id', professionalId)
    .gt('expira_em', now)
    .order('expira_em', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const minutosLivres = data.minutos_total - data.minutos_usados;

  return {
    minutosTotal:  data.minutos_total,
    minutosUsados: data.minutos_usados,
    minutosLivres,
    horasLivres:   parseFloat((minutosLivres / 60).toFixed(1)),
    expiraEm:      data.expira_em,
    baixo:         minutosLivres < LOW_BALANCE_MINUTES,
  };
}

/**
 * Regra de negócio: só é possível reservar sala com saldo de horas no banco.
 * O saldo vem de pacote pré-comprado OU de crédito de indicação — ambos gravados
 * em `hour_balance`. Soma todas as linhas não-expiradas (podem coexistir) e
 * retorna true se houver ao menos 1 minuto livre.
 */
export async function hasReservationCredit(
  professionalId: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('hour_balance')
    .select('minutos_total, minutos_usados')
    .eq('professional_id', professionalId)
    .gt('expira_em', now);

  if (error) throw error;
  if (!data || data.length === 0) return false;

  const minutosLivres = data.reduce(
    (sum, r) => sum + (r.minutos_total - r.minutos_usados),
    0,
  );
  return minutosLivres > 0;
}

// ─── Plano atual ─────────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  planName:   string;    // "BASE" | "PRO" | "VIP"
  ciclo:      string;    // "mensal" | "anual"
  status:     string;    // "active" | "pending" | "cancelled"
  precoMensal: number;
  taxaMin:    number;
  startsAt:   string;
  endsAt:     string | null;
}

// ─── Histórico mensal de minutagem ──────────────────────────────────────────

export interface MonthlyUsageSummary {
  period:        string;   // "Abril 2026"
  totalValor:    number;
  totalMinutos:  number;
  totalSessoes:  number;
}

/**
 * Busca os últimos N meses de minutagem agregada por mês.
 * Usado para o histórico na tela Financeiro.
 */
export async function fetchMonthlyUsageHistory(
  professionalId: string,
  months: number = 3,
): Promise<MonthlyUsageSummary[]> {
  const now = new Date();
  const results: MonthlyUsageSummary[] = [];

  for (let i = 1; i <= months; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const start = new Date(year, month - 1, 1).toISOString();
    const end   = new Date(year, month,     1).toISOString();

    const { data } = await supabase
      .from('usage_charges')
      .select('valor_total, minutos')
      .eq('professional_id', professionalId)
      .gte('iniciado_em', start)
      .lt('iniciado_em', end);

    const charges      = data ?? [];
    const totalValor   = charges.reduce((s: number, c: { valor_total: number }) => s + (c.valor_total ?? 0), 0);
    const totalMinutos = charges.reduce((s: number, c: { minutos: number }) => s + (c.minutos ?? 0), 0);

    const periodLabel = d
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, ch => ch.toUpperCase());

    results.push({
      period:       periodLabel,
      totalValor:   parseFloat(totalValor.toFixed(2)),
      totalMinutos,
      totalSessoes: charges.length,
    });
  }

  return results;
}

// ─── Pacotes de horas (fonte: DB — gerenciado pelo Admin) ────────────────────

import type { HourPackage } from '../models/types';

export async function fetchHourPackages(): Promise<HourPackage[]> {
  const { data, error } = await supabase
    .from('hour_packages')
    .select('horas, valor, bonus_horas')
    .eq('ativo', true)
    .order('horas');
  if (error) throw error;
  return ((data ?? []) as unknown as { horas: number; valor: number; bonus_horas: number }[]).map(r => ({
    hours:      Number(r.horas),
    price:      Number(r.valor),
    bonusHours: Number(r.bonus_horas ?? 0),
  }));
}

export async function fetchActiveSubscription(
  professionalId: string,
): Promise<SubscriptionInfo | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      ciclo,
      status,
      starts_at,
      ends_at,
      plans ( nome, preco_mensal, taxa_min )
    `)
    .eq('professional_id', professionalId)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const plan: any = data.plans;

  return {
    planName:    plan?.nome      ?? '—',
    ciclo:       data.ciclo,
    status:      data.status,
    precoMensal: plan?.preco_mensal ?? 0,
    taxaMin:     plan?.taxa_min     ?? 0,
    startsAt:    data.starts_at,
    endsAt:      data.ends_at ?? null,
  };
}
