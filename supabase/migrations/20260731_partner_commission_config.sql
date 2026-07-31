-- Comissão de parceiro vira editável no admin (em vez de fixa em código) —
-- pedido do fundador ao ver que "MBS Hackathon" (parceiro que só traz leads,
-- sem comissionamento) apareceria com comissão calculada na tela /parceiros.
CREATE TABLE public.partner_commission_config (
  partner_id             uuid PRIMARY KEY REFERENCES public.profiles(id),
  comissiona             boolean NOT NULL DEFAULT true,
  primeira_hora_pct      numeric NOT NULL DEFAULT 100,
  valor_base_anual       numeric NOT NULL DEFAULT 359,
  valor_pro_anual        numeric NOT NULL DEFAULT 719,
  valor_base_mensal      numeric NOT NULL DEFAULT 179,
  valor_pro_mensal       numeric NOT NULL DEFAULT 359,
  carencia_dias_mensal   int NOT NULL DEFAULT 60,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.partner_commission_config IS
  'Regras de comissão editáveis por parceiro externo (Programa de Indicação de Parceiros Externos). comissiona=false = parceiro só gera leads, sem comissão (ex.: MBS Hackathon).';

ALTER TABLE public.partner_commission_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.partner_commission_config
  FOR ALL USING (is_oli_admin()) WITH CHECK (is_oli_admin());

INSERT INTO public.partner_commission_config (partner_id, comissiona)
SELECT id, true FROM public.profiles WHERE referral_code = 'MAR-8124A'
ON CONFLICT (partner_id) DO NOTHING;

INSERT INTO public.partner_commission_config (partner_id, comissiona)
SELECT id, false FROM public.profiles WHERE referral_code = 'MBS-81CCB'
ON CONFLICT (partner_id) DO NOTHING;
