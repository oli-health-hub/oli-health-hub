/**
 * Checkout Service — OLI Health Hub
 *
 * Orquestra compras de módulos e assinaturas de plano via Asaas.
 * Chama as Edge Functions create-charge / create-subscription e
 * fornece um helper para verificar ativação pós-pagamento.
 */

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type BillingType = 'CREDIT_CARD' | 'PIX' | 'BOLETO_BANCARIO';

export interface ModuleChargeResult {
  chargeId:      string;
  status:        string;
  invoiceUrl:    string | null;
  billingType:   string;
  value:         number;
  valorOriginal?: number;
  desconto?:     number;
  dueDate:       string;
  bankSlipUrl:   string | null;
  pixQrCode:     string | null;
  pixCopiaECola: string | null;
}

/** Resultado da pré-validação de um cupom (antes de pagar). */
export interface CouponPreview {
  valid:       boolean;
  error?:      string;
  desconto:    number;
  valorFinal:  number;
}

/** Valida um cupom e calcula o desconto sem criar cobrança (preview no checkout). */
export async function validateCouponPreview(
  code:       string,
  targetType: 'modulo' | 'plano' | 'pacote',
  baseValue:  number,
  professionalId: string,
): Promise<CouponPreview> {
  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code:            code.trim(),
    p_target_type:     targetType,
    p_base_value:      baseValue,
    p_professional_id: professionalId,
  });
  if (error) return { valid: false, error: 'Erro ao validar cupom', desconto: 0, valorFinal: baseValue };
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.valid) return { valid: false, error: (r.error as string) ?? 'Cupom inválido', desconto: 0, valorFinal: baseValue };
  return {
    valid:      true,
    desconto:   Number(r.desconto),
    valorFinal: Number(r.valor_final),
  };
}

export interface SubscriptionResult {
  subscriptionId: string;
  supabaseSubId:  string | null;
  status:         string;
  ciclo:          string;
  value:          number;
  valorOriginal?:  number;
  desconto?:       number;
  planoRecorrente?: boolean;
  dueDate:        string;
  invoiceUrl:     string | null;
  bankSlipUrl:    string | null;
  pixQrCode:      string | null;
  pixCopiaECola:  string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EDGE FUNCTION CALLS
// ─────────────────────────────────────────────────────────────────────────────

/** Cria cobrança avulsa no Asaas para compra de módulo */
export async function createModuleCharge(
  moduleSlug:  string,
  billingType: BillingType = 'CREDIT_CARD',
  cpfCnpj?:   string,
  couponCode?: string,
): Promise<ModuleChargeResult> {
  const { data, error } = await supabase.functions.invoke('create-charge', {
    body: { moduleSlug, billingType, cpfCnpj, couponCode },
  });
  if (error) throw new Error(error.message ?? 'Erro ao criar cobrança');
  if (data?.error) throw new Error(data.error as string);
  return data as ModuleChargeResult;
}

/** Cria assinatura recorrente no Asaas para contratação de plano */
export async function createPlanSubscription(
  planId:      string,
  ciclo:       'MONTHLY' | 'YEARLY' = 'MONTHLY',
  billingType: BillingType = 'CREDIT_CARD',
  cpfCnpj?:   string,
  couponCode?: string,
): Promise<SubscriptionResult> {
  const { data, error } = await supabase.functions.invoke('create-subscription', {
    body: { planId, ciclo, billingType, cpfCnpj, couponCode },
  });
  if (error) throw new Error(error.message ?? 'Erro ao criar assinatura');
  if (data?.error) throw new Error(data.error as string);
  return data as SubscriptionResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLING
// ─────────────────────────────────────────────────────────────────────────────

/** Cache slug → UUID para evitar lookups repetidos */
const _moduleIdCache = new Map<string, string>();

async function resolveModuleDbId(slug: string): Promise<string | null> {
  if (_moduleIdCache.has(slug)) return _moduleIdCache.get(slug)!;
  const { data } = await supabase
    .from('modules')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  const id = (data as { id: string } | null)?.id;
  if (id) _moduleIdCache.set(slug, id);
  return id ?? null;
}

/** Cria cobrança avulsa no Asaas para compra de pacote de horas */
export async function createHourPackageCharge(
  hours:       number,
  billingType: BillingType = 'CREDIT_CARD',
  cpfCnpj?:   string,
  couponCode?: string,
): Promise<ModuleChargeResult> {
  const { data, error } = await supabase.functions.invoke('create-hour-package', {
    body: { hours, billingType, cpfCnpj, couponCode },
  });
  if (error) throw new Error(error.message ?? 'Erro ao criar cobrança');
  if (data?.error) throw new Error(data.error as string);
  return data as ModuleChargeResult;
}

/**
 * Verifica se o pacote de horas já foi creditado no hour_balance.
 * Chamado periodicamente pelo HourCheckoutModal (intervalo de 5 s).
 */
export async function checkHourPackageActivation(
  professionalId: string,
  chargeId:       string,
): Promise<boolean> {
  const { data } = await supabase
    .from('hour_balance')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('asaas_charge_id', chargeId)
    .maybeSingle();

  return data !== null;
}

/**
 * Verifica se a assinatura de plano já foi ativada (status = active).
 * Chamado periodicamente pelo PlanCheckoutModal (intervalo de 5 s).
 */
export async function checkPlanActivation(
  professionalId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('professional_id', professionalId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  return data !== null;
}

/**
 * Verifica uma vez se o módulo já está ativo para o profissional.
 * Chamado periodicamente pelo CheckoutModal (intervalo de 5 s).
 */
export async function checkModuleActivation(
  moduleSlug:     string,
  professionalId: string,
): Promise<boolean> {
  const moduleDbId = await resolveModuleDbId(moduleSlug);
  if (!moduleDbId) return false;

  const { data } = await supabase
    .from('user_modules')
    .select('status')
    .eq('professional_id', professionalId)
    .eq('module_id', moduleDbId)
    .maybeSingle();

  return (data as { status: string } | null)?.status === 'active';
}
