-- Infra da régua de nutrição comercial (docs/WHATSAPP_NUTRICAO_COMERCIAL.md).
--
-- Fica pronta e INERTE: nenhuma mensagem sai daqui enquanto o template
-- correspondente em `whatsapp_templates.status_aprovacao` não virar
-- 'aprovado' — mesmo gate que `send-patient-trigger` já usa pros templates
-- de paciente. Sem ninguém marcar opt-in numa linha de `leads`, nenhuma
-- etapa é criada; sem etapa, o cron não tem o que fazer.

-- ── Opt-in de WhatsApp por lead ─────────────────────────────────────────────
-- Sem `whatsapp_opt_in_at`, o lead é inelegível pra régua — não existe disparo
-- automático sem consentimento registrado.
alter table leads add column if not exists whatsapp_opt_in_at     timestamptz;
alter table leads add column if not exists whatsapp_opt_in_source text;
alter table leads add column if not exists whatsapp_opt_out_at    timestamptz;

-- ── Agenda persistente de nutrição ──────────────────────────────────────────
-- Uma linha por etapa por lead. `unique(lead_id, etapa)` é o que impede
-- duplicidade em reexecução do cron — a etapa só existe uma vez na vida do lead.
create table if not exists whatsapp_nutricao_etapas (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  etapa         text not null check (etapa = any (array['primeiro_contato','d3','d10','d24','d45'])),
  status        text not null default 'agendada' check (status = any (array['agendada','cancelada','enviada','falhou'])),
  data_prevista timestamptz not null,
  enviado_em    timestamptz,
  erro          text,
  created_at    timestamptz not null default now(),
  unique (lead_id, etapa)
);

create index if not exists idx_nutricao_etapas_pendentes
  on whatsapp_nutricao_etapas (data_prevista)
  where status = 'agendada';

alter table whatsapp_nutricao_etapas enable row level security;
create policy "admin_all_whatsapp_nutricao_etapas" on whatsapp_nutricao_etapas
  for all using (is_oli_admin()) with check (is_oli_admin());

comment on table whatsapp_nutricao_etapas is
  'Agenda da régua de nutrição comercial por WhatsApp — uma linha por etapa (primeiro_contato/d3/d10/d24/d45) por lead. O relógio de cada etapa começa no envio da anterior, não em D0 absoluto (ver docs/WHATSAPP_NUTRICAO_COMERCIAL.md).';

-- ── Templates da régua ───────────────────────────────────────────────────────
-- Reaproveita a tabela que send-patient-trigger já usa: `status_aprovacao`
-- é o gate único de ativação, sem precisar de env var extra de liga/desliga.
alter table whatsapp_templates drop constraint if exists whatsapp_templates_trigger_type_check;
alter table whatsapp_templates add constraint whatsapp_templates_trigger_type_check
  check (trigger_type = any (array[
    'confirmacao_consulta', 'lembrete_vespera',
    'primeiro_contato', 'd3', 'd10', 'd24', 'd45'
  ]));

insert into whatsapp_templates (trigger_type, meta_template_name, idioma, corpo, variaveis, status_aprovacao) values
(
  'primeiro_contato',
  'primeiro_contato_comercial_v1',
  'pt_BR',
  E'Olá, {{1}}! Sou a Olivia, assistente virtual do OLI Health Hub.\n\nPosso ajudar você a conhecer como funcionam os nossos espaços para profissionais da saúde?',
  '["primeiro_nome"]',
  'pendente'
),
(
  'd3',
  'nutricao_comercial_d3_v1',
  'pt_BR',
  E'Olá, {{1}}! Passando para saber se ainda faz sentido conhecer o OLI Health Hub.\n\nSe quiser, posso responder dúvidas sobre os espaços e como funciona o uso no dia a dia.',
  '["primeiro_nome"]',
  'pendente'
),
(
  'd10',
  'nutricao_comercial_d10_v1',
  'pt_BR',
  E'Olá, {{1}}! O OLI reúne estrutura física para atendimento e ferramentas de gestão para a rotina profissional.\n\nSe esse formato fizer sentido para você, posso ajudar a indicar o melhor próximo passo.',
  '["primeiro_nome"]',
  'pendente'
),
(
  'd24',
  'nutricao_comercial_d24_v1',
  'pt_BR',
  E'Olá, {{1}}! Se quiser conhecer o OLI de perto, você pode agendar uma visita no momento que for melhor para você.',
  '["primeiro_nome"]',
  'pendente'
),
(
  'd45',
  'nutricao_comercial_d45_v1',
  'pt_BR',
  E'Olá, {{1}}! Como não tivemos retorno, vamos pausar nossas mensagens por aqui.\n\nQuando quiser retomar e conhecer o OLI Health Hub, basta responder a esta conversa.',
  '["primeiro_nome"]',
  'pendente'
)
on conflict (trigger_type) do nothing;

-- ── Cron ─────────────────────────────────────────────────────────────────────
-- Mesmo horário comercial do whatsapp-nudge-silencio (9h-19h BRT = 12h-21h UTC).
-- A função em si decide, etapa a etapa, se o template já está aprovado.
select cron.schedule(
  'whatsapp-nutricao-comercial',
  '*/30 12-21 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name='supabase_url' limit 1)
               || '/functions/v1/whatsapp-nutricao-comercial',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key' limit 1),
                 'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
