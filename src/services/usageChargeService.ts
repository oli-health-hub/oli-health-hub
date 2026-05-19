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
  professionalId:  string;
  reservationId:   string | null;
  plan:            PlanType;
  startedAt:       string;   // ISO — consultationStartedAt da reserva
  endedAt:         string;   // ISO — agora (quando endRoomUse foi chamado)
}

export interface UsageChargeSummary {
  minutos:     number;
  taxaMin:     number;
  valorTotal:  number;
}

/**
 * Calcula o resumo de cobrança sem efeitos colaterais.
 * Útil para exibir o custo no alerta de checkout antes de confirmar.
 */
export function calcUsageCharge(params: UsageChargeParams): UsageChargeSummary {
  const taxaMin    = COST_PER_MINUTE[params.plan];
  const startMs    = new Date(params.startedAt).getTime();
  const endMs      = new Date(params.endedAt).getTime();
  const minutos    = Math.max(0, Math.ceil((endMs - startMs) / 60_000));
  const valorTotal = parseFloat((minutos * taxaMin).toFixed(2));

  return { minutos, taxaMin, valorTotal };
}

/**
 * Persiste o log de minutagem no Supabase.
 * Lança erro se o insert falhar (o chamador deve tratar silenciosamente).
 */
export async function logUsageCharge(params: UsageChargeParams): Promise<UsageChargeSummary> {
  const summary = calcUsageCharge(params);

  const { error } = await supabase.from('usage_charges').insert({
    professional_id: params.professionalId,
    reservation_id:  params.reservationId,
    iniciado_em:     params.startedAt,
    encerrado_em:    params.endedAt,
    minutos:         summary.minutos,
    taxa_min:        summary.taxaMin,
    valor_total:     summary.valorTotal,
    tipo_cobranca:   'subscription',   // padrão; atualizado na Fase 1 para hour_package quando aplicável
  });

  if (error) throw error;
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
