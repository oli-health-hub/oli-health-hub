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
