-- Enum `notification_type` não tinha `hour_package_purchased`/`hour_package_activated`.
-- `create-hour-package` (linha ~144) e `asaas-webhook` (linha ~168) já inseriam
-- admin_notifications com esses tipos há tempo, mas o insert é fire-and-forget
-- (`.then(() => {}).catch(() => {})`) — falhava contra o enum em silêncio.
-- Resultado: compra/ativação de pacote de horas nunca apareceu na Fila de Trabalho.
-- Aplicada em produção via Supabase MCP em 28/ago/2026. Ver docs/HANDOFF.md §47.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hour_package_purchased';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hour_package_activated';
