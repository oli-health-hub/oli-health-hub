-- Programa de Indicação de Parceiros Externos (docs/HANDOFF.md §11 item 19).
-- Comissão devida é calculada em runtime no admin (/parceiros) a partir de
-- referrals + subscriptions + usage_charges já existentes — esta tabela só
-- guarda o que já foi efetivamente pago, para não duplicar dado derivável.
CREATE TABLE public.partner_commission_payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id               uuid NOT NULL REFERENCES public.profiles(id),
  referred_professional_id uuid NOT NULL REFERENCES public.profiles(id),
  tipo                     text NOT NULL CHECK (tipo = ANY (ARRAY['primeira_hora_start','base_anual','pro_anual','base_mensal','pro_mensal'])),
  valor                    numeric NOT NULL CHECK (valor > 0),
  pago_em                  timestamptz NOT NULL DEFAULT now(),
  observacoes              text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_professional_id, tipo)
);

COMMENT ON TABLE public.partner_commission_payments IS
  'Registro de comissões já pagas a parceiros externos (Programa de Indicação de Parceiros Externos). Cálculo do valor devido é feito em runtime no admin a partir de referrals/subscriptions/usage_charges — esta tabela só guarda o que já foi efetivamente pago, evitando duplicar dado derivável.';

ALTER TABLE public.partner_commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.partner_commission_payments
  FOR ALL USING (is_oli_admin()) WITH CHECK (is_oli_admin());
