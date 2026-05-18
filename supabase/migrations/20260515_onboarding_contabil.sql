-- ─── Migração: Onboarding Diagnóstico Contábil ───────────────────────────────
-- Adiciona campos do questionário contábil à tabela profiles.
-- 10 perguntas → 11 colunas (Q9 tem dois campos: possui + previsão).
-- Todos os campos contábeis são nullable — retrocompatível com usuários existentes.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete      boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS situacao_juridica         text,       -- Q1: 'pf' | 'pj' | 'ambos'
  ADD COLUMN IF NOT EXISTS faturamento_range         text,       -- Q2: 'ate_10k' | '10k_30k' | ...
  ADD COLUMN IF NOT EXISTS atividade_exercida        text,       -- Q3: livre (especialidade/atividade)
  ADD COLUMN IF NOT EXISTS possui_clt                boolean,    -- Q4: true | false
  ADD COLUMN IF NOT EXISTS local_atuacao             text,       -- Q5: 'proprio' | 'terceiros' | 'ambos'
  ADD COLUMN IF NOT EXISTS num_locais                text,       -- Q6: '1' | '2_3' | '4_6' | 'mais_6'
  ADD COLUMN IF NOT EXISTS cidade_uf                 text,       -- Q7: livre ('São Paulo/SP')
  ADD COLUMN IF NOT EXISTS notas_fiscais_range       text,       -- Q8: 'nao_emite' | 'ate_5' | ...
  ADD COLUMN IF NOT EXISTS possui_funcionarios       boolean,    -- Q9a
  ADD COLUMN IF NOT EXISTS previsao_contratacao      boolean,    -- Q9b (quando possui_funcionarios=false)
  ADD COLUMN IF NOT EXISTS possui_socios             boolean;    -- Q10

-- CHECK constraints para valores válidos
ALTER TABLE profiles
  ADD CONSTRAINT chk_situacao_juridica
    CHECK (situacao_juridica IS NULL OR situacao_juridica IN ('pf', 'pj', 'ambos')),
  ADD CONSTRAINT chk_faturamento_range
    CHECK (faturamento_range IS NULL OR faturamento_range IN ('ate_10k', '10k_30k', '30k_80k', '80k_160k', 'acima_160k')),
  ADD CONSTRAINT chk_local_atuacao
    CHECK (local_atuacao IS NULL OR local_atuacao IN ('proprio', 'terceiros', 'ambos')),
  ADD CONSTRAINT chk_num_locais
    CHECK (num_locais IS NULL OR num_locais IN ('1', '2_3', '4_6', 'mais_6')),
  ADD CONSTRAINT chk_notas_fiscais_range
    CHECK (notas_fiscais_range IS NULL OR notas_fiscais_range IN ('nao_emite', 'ate_5', '6_20', '21_50', 'acima_50'));

-- Tabela NPS (coleta de feedback dos médicos)
CREATE TABLE IF NOT EXISTS nps_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score            smallint NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment          text,
  context          text NOT NULL DEFAULT 'manual',  -- 'pos_reserva' | 'mensal' | 'pos_onboarding'
  created_at       timestamp with time zone DEFAULT now()
);

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nps_own_data" ON nps_responses
  FOR ALL USING (professional_id = auth.uid());

-- Índice para consultas por profissional
CREATE INDEX IF NOT EXISTS idx_nps_professional ON nps_responses (professional_id, created_at DESC);
