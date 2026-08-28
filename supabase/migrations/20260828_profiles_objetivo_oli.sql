-- Onboarding passa a capturar especialidade, cidade/UF, tipo de atendimento
-- (já existiam como colunas opcionais, viram obrigatórios) e uma intenção
-- declarada de uso, que não existia em lugar nenhum do schema.
-- Aplicada em produção via Supabase MCP em 28/ago/2026. Ver docs/HANDOFF.md.
ALTER TABLE profiles ADD COLUMN objetivo_oli text
  CHECK (objetivo_oli IN ('migrar_rotina','espaco_avulso','so_conhecer'));
