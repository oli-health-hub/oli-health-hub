-- ─────────────────────────────────────────────────────────────────────────────
-- OLI Health Hub — Infraestrutura de Cobrança (Fase 1)
-- Migration: 20260518_billing_infrastructure
-- Tabelas: plans, subscriptions, hour_packages, hour_balance,
--          usage_charges, modules, user_modules, referrals
-- Alterações em profiles: user_type, plan_id, pre_paid_ok
-- ─────────────────────────────────────────────────────────────────────────────

-- ── plans ─────────────────────────────────────────────────────────────────────
-- Catálogo de planos. Preços NUNCA hardcoded no app — virão desta tabela.

CREATE TABLE IF NOT EXISTS plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL UNIQUE,          -- 'BASE' | 'PRO' | 'VIP'
  preco_mensal  numeric(10,2) NOT NULL,
  preco_anual   numeric(10,2) NOT NULL,               -- valor total do ano (com desconto)
  taxa_min      numeric(6,4) NOT NULL,                -- R$ por minuto de sala
  features      jsonb       NOT NULL DEFAULT '{}',    -- inclusões do plano
  ativo         boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── subscriptions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id          uuid        NOT NULL REFERENCES plans(id),
  ciclo            text        NOT NULL CHECK (ciclo IN ('mensal', 'anual')),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','active','past_due','cancelled','trialing')),
  asaas_id         text        UNIQUE,                -- ID do customer/subscription no Asaas
  starts_at        timestamptz NOT NULL DEFAULT now(),
  ends_at          timestamptz,                       -- null = renovação automática
  cancelled_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── hour_packages ─────────────────────────────────────────────────────────────
-- Catálogo de pacotes de horas disponíveis para compra.

CREATE TABLE IF NOT EXISTS hour_packages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text        NOT NULL,
  horas          numeric(6,2) NOT NULL,
  valor          numeric(10,2) NOT NULL,
  validade_dias  integer     NOT NULL DEFAULT 30,
  ativo          boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── hour_balance ──────────────────────────────────────────────────────────────
-- Saldo de minutos disponíveis por usuário (compras em pacotes).
-- Usamos minutos internamente para máxima precisão.

CREATE TABLE IF NOT EXISTS hour_balance (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id       uuid        REFERENCES hour_packages(id),
  minutos_total    integer     NOT NULL CHECK (minutos_total > 0),
  minutos_usados   integer     NOT NULL DEFAULT 0 CHECK (minutos_usados >= 0),
  asaas_charge_id  text,                              -- cobrança Asaas que originou este crédito
  expira_em        timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hour_balance_used_lte_total CHECK (minutos_usados <= minutos_total)
);

-- ── usage_charges ─────────────────────────────────────────────────────────────
-- Log imutável de minutagem por sessão de sala.
-- Inserido pelo app ao encerrar reserva; auditável pela equipe OLI.

CREATE TABLE IF NOT EXISTS usage_charges (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reservation_id   uuid        REFERENCES reservations(id) ON DELETE SET NULL,
  subscription_id  uuid        REFERENCES subscriptions(id) ON DELETE SET NULL,
  hour_balance_id  uuid        REFERENCES hour_balance(id)  ON DELETE SET NULL,
  iniciado_em      timestamptz NOT NULL,
  encerrado_em     timestamptz NOT NULL,
  minutos          integer     NOT NULL CHECK (minutos >= 0),
  taxa_min         numeric(6,4) NOT NULL,              -- taxa vigente no momento da sessão
  valor_total      numeric(10,2) NOT NULL,             -- minutos × taxa_min
  tipo_cobranca    text        NOT NULL
                               CHECK (tipo_cobranca IN ('subscription','hour_package')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── modules ───────────────────────────────────────────────────────────────────
-- Catálogo de módulos à la carte.

CREATE TABLE IF NOT EXISTS modules (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text        NOT NULL,
  descricao    text,
  valor        numeric(10,2) NOT NULL,
  tipo         text        NOT NULL CHECK (tipo IN ('mensal','avulso','unico')),
  categoria    text        NOT NULL
               CHECK (categoria IN ('tecnologia','juridico','contabil','convenios','carreira','bpo')),
  ativo        boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── user_modules ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_modules (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id        uuid        NOT NULL REFERENCES modules(id),
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','cancelled','expired')),
  asaas_id         text,
  ativo_ate        timestamptz,                        -- null = mensal sem data final
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── referrals ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  indicado_id       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  codigo            text        UNIQUE NOT NULL,       -- código único compartilhável
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','converted','rewarded')),
  beneficio_aplicado boolean    NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Alterações em profiles ────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_type   text    NOT NULL DEFAULT 'subscriber'
                                       CHECK (user_type IN ('subscriber','hour_user','admin')),
  ADD COLUMN IF NOT EXISTS plan_id     uuid    REFERENCES plans(id),
  ADD COLUMN IF NOT EXISTS pre_paid_ok boolean NOT NULL DEFAULT false;

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_professional  ON subscriptions(professional_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status        ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas         ON subscriptions(asaas_id);
CREATE INDEX IF NOT EXISTS idx_hour_balance_professional   ON hour_balance(professional_id);
CREATE INDEX IF NOT EXISTS idx_hour_balance_expira         ON hour_balance(expira_em);
CREATE INDEX IF NOT EXISTS idx_usage_charges_professional  ON usage_charges(professional_id);
CREATE INDEX IF NOT EXISTS idx_usage_charges_reservation   ON usage_charges(reservation_id);
CREATE INDEX IF NOT EXISTS idx_usage_charges_created       ON usage_charges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_modules_professional   ON user_modules(professional_id);
CREATE INDEX IF NOT EXISTS idx_user_modules_status         ON user_modules(status);
CREATE INDEX IF NOT EXISTS idx_referrals_codigo            ON referrals(codigo);
CREATE INDEX IF NOT EXISTS idx_referrals_indicador         ON referrals(indicador_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_balance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_modules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals     ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: verifica se o usuário logado é admin
CREATE OR REPLACE FUNCTION is_oli_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
  );
$$;

-- plans: catálogo público (leitura); escrita só para admin
CREATE POLICY "plans_select_public"    ON plans FOR SELECT USING (true);
CREATE POLICY "plans_admin_write"      ON plans FOR ALL    USING (is_oli_admin());

-- subscriptions: usuário vê as suas; admin vê todas
CREATE POLICY "subscriptions_own_read" ON subscriptions FOR SELECT
  USING (professional_id = auth.uid());
CREATE POLICY "subscriptions_admin"    ON subscriptions FOR ALL    USING (is_oli_admin());

-- hour_packages: catálogo público
CREATE POLICY "hour_packages_select"   ON hour_packages FOR SELECT USING (true);
CREATE POLICY "hour_packages_admin"    ON hour_packages FOR ALL    USING (is_oli_admin());

-- hour_balance: próprio usuário
CREATE POLICY "hour_balance_own_read"  ON hour_balance FOR SELECT
  USING (professional_id = auth.uid());
CREATE POLICY "hour_balance_admin"     ON hour_balance FOR ALL     USING (is_oli_admin());

-- usage_charges: próprio usuário lê e insere; admin vê tudo
CREATE POLICY "usage_charges_own_read" ON usage_charges FOR SELECT
  USING (professional_id = auth.uid());
CREATE POLICY "usage_charges_own_ins"  ON usage_charges FOR INSERT
  WITH CHECK (professional_id = auth.uid());
CREATE POLICY "usage_charges_admin"    ON usage_charges FOR ALL    USING (is_oli_admin());

-- modules: catálogo público
CREATE POLICY "modules_select_public"  ON modules FOR SELECT USING (true);
CREATE POLICY "modules_admin_write"    ON modules FOR ALL    USING (is_oli_admin());

-- user_modules: próprio usuário lê; admin gerencia
CREATE POLICY "user_modules_own_read"  ON user_modules FOR SELECT
  USING (professional_id = auth.uid());
CREATE POLICY "user_modules_admin"     ON user_modules FOR ALL     USING (is_oli_admin());

-- referrals: indicador e indicado leem; indicador insere
CREATE POLICY "referrals_own_read"     ON referrals FOR SELECT
  USING (indicador_id = auth.uid() OR indicado_id = auth.uid());
CREATE POLICY "referrals_own_insert"   ON referrals FOR INSERT
  WITH CHECK (indicador_id = auth.uid());
CREATE POLICY "referrals_admin"        ON referrals FOR ALL        USING (is_oli_admin());

-- ── Seed: planos iniciais ─────────────────────────────────────────────────────
-- Preços da reunião de parceiros 15/05/2026.
-- VIP anual é padrão: features inclui 'annual_required' = true.

INSERT INTO plans (name, preco_mensal, preco_anual, taxa_min, features) VALUES
  ('BASE', 299.00,  2990.00,  1.70, '{
    "events_month": 1,
    "juridico": "basico",
    "contabil": "orientacao",
    "annual_required": false
  }'),
  ('PRO',  599.00,  5990.00,  1.60, '{
    "communicare": "basico",
    "operacao_assistida": true,
    "juridico": "expandido",
    "contabil": "inicial",
    "annual_required": false
  }'),
  ('VIP',  1199.00, 11990.00, 1.50, '{
    "communicare": "premium",
    "contabil": "integrada",
    "juridico": "continuo",
    "networking_vip": true,
    "bpo_financeiro": true,
    "annual_required": true
  }')
ON CONFLICT (name) DO NOTHING;

-- ── Seed: pacotes de horas iniciais ──────────────────────────────────────────

INSERT INTO hour_packages (nome, horas, valor, validade_dias) VALUES
  ('Avulso 1h',          1,  140.00,  30),
  ('Pacote Starter 10h', 10, 1100.00, 60),
  ('Pacote Médio 20h',   20, 2000.00, 90),
  ('Pacote Intensivo 40h', 40, 3600.00, 90)
ON CONFLICT DO NOTHING;
