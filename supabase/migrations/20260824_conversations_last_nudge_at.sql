-- Rastreia se já mandamos 1 mensagem de reengajamento pra esse silêncio
-- específico do lead (não repete a cada execução do cron). Ver
-- whatsapp-nudge-silencio e docs/IA_ATENDIMENTO_WHATSAPP.md.
alter table public.conversations add column last_nudge_at timestamptz null;
