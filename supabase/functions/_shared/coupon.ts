/**
 * Utilitários de cupom de desconto para as Edge Functions de checkout.
 * Valida via RPC `validate_coupon` (mínimo R$5 aplicado lá) e registra resgate
 * pendente — confirmado no asaas-webhook ao pagamento.
 */

// deno-lint-ignore no-explicit-any
type Admin = any;

export type CouponTarget = 'modulo' | 'plano' | 'pacote';

export interface CouponResult {
  valid:            boolean;
  error?:           string;
  couponId?:        string;
  tipo?:            string;
  valor?:           number;
  desconto?:        number;
  valorFinal?:      number;
  planoRecorrente?: boolean;
}

/** Valida cupom e calcula desconto. Não incrementa uso (isso ocorre no webhook). */
export async function validateCoupon(
  admin:          Admin,
  code:           string,
  targetType:     CouponTarget,
  baseValue:      number,
  professionalId: string,
): Promise<CouponResult> {
  const { data, error } = await admin.rpc('validate_coupon', {
    p_code:            code,
    p_target_type:     targetType,
    p_base_value:      baseValue,
    p_professional_id: professionalId,
  });
  if (error) return { valid: false, error: 'Erro ao validar cupom' };

  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.valid) return { valid: false, error: (r.error as string) ?? 'Cupom inválido' };

  return {
    valid:           true,
    couponId:        r.coupon_id as string,
    tipo:            r.tipo as string,
    valor:           Number(r.valor),
    desconto:        Number(r.desconto),
    valorFinal:      Number(r.valor_final),
    planoRecorrente: r.plano_recorrente as boolean,
  };
}

/** Registra resgate pendente (status confirmado no webhook ao pagamento). */
export async function recordRedemption(
  admin: Admin,
  args: {
    couponId:       string;
    professionalId: string;
    targetType:     CouponTarget;
    targetRef:      string;
    baseValue:      number;
    desconto:       number;
    valorFinal:     number;
    asaasId:        string;
  },
): Promise<void> {
  await admin.from('coupon_redemptions').insert({
    coupon_id:       args.couponId,
    professional_id: args.professionalId,
    target_type:     args.targetType,
    target_ref:      args.targetRef,
    base_value:      args.baseValue,
    desconto:        args.desconto,
    valor_final:     args.valorFinal,
    asaas_id:        args.asaasId,
    status:          'pending',
  });
}
