/**
 * usageChargeService.ts
 *
 * Registra no Supabase o custo de minutagem ao encerrar uma sessão de sala.
 * Chamado pelo appStore.endRoomUse() após marcar reserva como 'concluido'.
 *
 * Fluxo:
 *   endRoomUse(id) → logUsageCharge(params) → INSERT usage_charges
 *
 * Taxa por minuto vem do COST_PER_MINUTE do store (sincronizado com a tabela
 * `plans` no Supabase quando a Fase 1 estiver completa).
 */

import { supabase } from './supabase';
import type { PlanType } from '../models/types';
import { COST_PER_MINUTE } from '../store/appStore';

export interface UsageChargeParams {
  professionalId:     string;
  reservationId:      string | null;
  plan:               PlanType;
  startedAt:          string;   // ISO — consultationStartedAt da reserva
  endedAt:            string;   // ISO — agora (quando endRoomUse foi chamado)
  scheduledEndTime?:  string;   // ISO — end_time da reserva (para cálculo de excedente)
}

export interface UsageChargeSummary {
  minutos:     number;
  taxaMin:     number;
  valorTotal:  number;
}

/**
 * Calcula o resumo de cobrança sem efeitos colaterais.
 * Útil para exibir o custo no alerta de checkout antes de confirmar.
 *
 * Regras de granularidade:
 *   • Tempo dentro da reserva (locação): contado por minuto (Math.ceil).
 *   • Excedente (após scheduledEndTime): arredondado para cima em blocos de 30 min.
 *     Ex.: 31 min excedentes → cobra 60 min; 1 min excedente → cobra 30 min.
 */
export function calcUsageCharge(params: UsageChargeParams): UsageChargeSummary {
  const taxaMin   = COST_PER_MINUTE[params.plan];
  const startMs   = new Date(params.startedAt).getTime();
  const endMs     = new Date(params.endedAt).getTime();
  const schedEnd  = params.scheduledEndTime ? new Date(params.scheduledEndTime).getTime() : null;

  let minutos: number;

  if (schedEnd && endMs > schedEnd) {
    // Tempo dentro da reserva: por minuto
    const minutosLocacao   = Math.max(0, Math.ceil((schedEnd - startMs) / 60_000));
    // Excedente: arredonda para cima em blocos de 30 min
    const msExcedente      = endMs - schedEnd;
    const minutosExcedente = Math.ceil(msExcedente / (30 * 60_000)) * 30;
    minutos = minutosLocacao + minutosExcedente;
  } else {
    // Sem excedente: tudo por minuto
    minutos = Math.max(0, Math.ceil((endMs - startMs) / 60_000));
  }

  const valorTotal = parseFloat((minutos * taxaMin).toFixed(2));
  return { minutos, taxaMin, valorTotal };
}

/**
 * Persiste o log de minutagem no Supabase.
 *
 * Regra de cobrança:
 *   1. Busca pacote de horas ativo (hour_balance) com saldo restante e não expirado.
 *   2. Se existir, desconta os minutos do pacote (até esgotá-lo).
 *   3. Excedente (se houver) cobra como subscription, no valor da taxa do plano.
 *   4. Sem pacote ativo → tudo cobrado como subscription.
 *
 * Lança erro se algum insert falhar (chamador trata silenciosamente).
 */
export async function logUsageCharge(params: UsageChargeParams): Promise<UsageChargeSummary> {
  const summary = calcUsageCharge(params);

  // 1. Busca pacote de horas com saldo
  const { data: balance } = await supabase
    .from('hour_balance')
    .select('id, minutos_total, minutos_usados')
    .eq('professional_id', params.professionalId)
    .gt('expira_em', new Date().toISOString())
    .order('expira_em', { ascending: true })  // FIFO: gasta o que expira primeiro
    .limit(1)
    .maybeSingle();

  type Balance = { id: string; minutos_total: number; minutos_usados: number };
  const b = balance as Balance | null;
  const remaining = b ? Math.max(0, b.minutos_total - b.minutos_usados) : 0;

  // 2. Sem pacote ativo → tudo subscription
  if (!b || remaining === 0) {
    const { error } = await supabase.from('usage_charges').insert({
      professional_id: params.professionalId,
      reservation_id:  params.reservationId,
      iniciado_em:     params.startedAt,
      encerrado_em:    params.endedAt,
      minutos:         summary.minutos,
      taxa_min:        summary.taxaMin,
      valor_total:     summary.valorTotal,
      tipo_cobranca:   'subscription',
    });
    if (error) throw error;
    return summary;
  }

  // 3. Com pacote: deduz até esgotar
  const fromPackage = Math.min(summary.minutos, remaining);
  const fromSub     = summary.minutos - fromPackage;

  // 3a. Cobrança do pacote (custo zero — já foi pago no momento da compra)
  const { error: errPkg } = await supabase.from('usage_charges').insert({
    professional_id:  params.professionalId,
    reservation_id:   params.reservationId,
    hour_balance_id:  b.id,
    iniciado_em:      params.startedAt,
    encerrado_em:     params.endedAt,
    minutos:          fromPackage,
    taxa_min:         0,
    valor_total:      0,
    tipo_cobranca:    'hour_package',
  });
  if (errPkg) throw errPkg;

  // 3b. Decrementa o saldo do pacote
  const { error: errBal } = await supabase
    .from('hour_balance')
    .update({ minutos_usados: b.minutos_usados + fromPackage })
    .eq('id', b.id);
  if (errBal) throw errBal;

  // 3c. Excedente cobrado como subscription (se houver)
  if (fromSub > 0) {
    const valor = parseFloat((fromSub * summary.taxaMin).toFixed(2));
    const { error: errSub } = await supabase.from('usage_charges').insert({
      professional_id: params.professionalId,
      reservation_id:  params.reservationId,
      iniciado_em:     params.startedAt,
      encerrado_em:    params.endedAt,
      minutos:         fromSub,
      taxa_min:        summary.taxaMin,
      valor_total:     valor,
      tipo_cobranca:   'subscription',
    });
    if (errSub) throw errSub;
  }

  return summary;
}

/**
 * Verifica o limite de autenticação antes do signIn.
 * Retorna { allowed, failedCount, remaining, blockedUntil }.
 */
export interface RateLimitResult {
  allowed:      boolean;
  failedCount:  number;
  remaining?:   number;
  blockedUntil?: string;
}

export async function checkAuthRateLimit(email: string): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('check_auth_rate_limit', {
    p_identifier: email.toLowerCase().trim(),
  });

  if (error) {
    // Se a função não existir ainda (migration pendente), libera o acesso sem bloquear
    return { allowed: true, failedCount: 0, remaining: 5 };
  }

  const result = data as { allowed: boolean; failed_count: number; remaining?: number; blocked_until?: string } | null;
  return {
    allowed:      result?.allowed       ?? true,
    failedCount:  result?.failed_count  ?? 0,
    remaining:    result?.remaining,
    blockedUntil: result?.blocked_until,
  };
}

export async function recordAuthAttempt(email: string, succeeded: boolean): Promise<void> {
  await supabase.rpc('record_auth_attempt', {
    p_identifier: email.toLowerCase().trim(),
    p_succeeded:  succeeded,
  });
}
