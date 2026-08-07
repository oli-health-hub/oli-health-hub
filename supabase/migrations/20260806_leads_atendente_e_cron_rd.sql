-- ============================================================================
-- Atendente do lead + rede de segurança da sincronização com a RD
-- Aplicadas em produção via Supabase MCP em 06/ago/2026.
-- Reconstitui `leads_atendente` e `cron_rd_vincular_e_sincronizar`.
-- Ver docs/HANDOFF.md §25 (buraco descoberto) e §26 (atendente).
-- ============================================================================

-- ─── Atendente ──────────────────────────────────────────────────────────────
-- FK para profiles, não texto livre nem lista fixa em código: os atendentes já
-- existem como perfis com acesso ao painel (Claudia, Igor, Guilherme).
-- Incluir uma quarta pessoa = conceder acesso ao painel, sem deploy.
-- Aproveita o decoupling is_admin × user_type feito em 21/jul.
--
-- ON DELETE SET NULL: se o perfil sumir, o lead continua existindo sem dono.
-- Perder o lead junto com o atendente seria bem pior que perder a atribuição.
alter table public.leads
  add column atendente_id uuid references public.profiles(id) on delete set null;

create index leads_atendente_idx on public.leads (atendente_id) where atendente_id is not null;

comment on column public.leads.atendente_id is
  'Quem está cuidando do lead. Aponta para profiles com is_admin = true. Nulo = ainda sem dono. Vive só no painel — a RD tem um único usuário para toda a conta.';

-- ─── Rede de segurança do espelhamento ──────────────────────────────────────
-- Buraco real observado em 06/ago: o webhook `crm_contact_created` entrega o
-- CONTATO, e nesse instante a negociação pode nem existir na RD. O lead entra
-- sem `rd_deal_id`, e o trigger de espelhamento pula quem não tem deal — EM
-- SILÊNCIO. Resultado: 7 leads com status mudado no painel e nada indo pra RD.
--
-- Vincular passa a ser recorrente, não carga única. A função também espelha o
-- status logo após vincular, porque UPDATE de `rd_deal_id` não dispara o
-- trigger (que só escuta `update of status`).
select cron.schedule(
  'rd-vincular-deals',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name='supabase_url' limit 1)
               || '/functions/v1/rd-vincular-deals',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key' limit 1),
                 'Content-Type', 'application/json'),
    body    := jsonb_build_object('dryRun', false),
    timeout_milliseconds := 120000
  );
  $$
);

-- Segunda rede: reprocessa quem ficou com erro de espelhamento. Separada da
-- vinculação de propósito — falha de rede na RD não deve travar a vinculação,
-- e vice-versa.
select cron.schedule(
  'rd-reprocessar-falhas-sync',
  '7,37 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name='supabase_url' limit 1)
               || '/functions/v1/rd-sync-status',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key' limit 1),
                 'Content-Type', 'application/json'),
    body    := jsonb_build_object('reprocessarFalhas', true),
    timeout_milliseconds := 120000
  );
  $$
);
