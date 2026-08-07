-- ============================================================================
-- RD Station como fonte de lead + telefone opcional
-- Aplicadas em produção via Supabase MCP em 03–04/ago/2026.
-- Reconstitui as migrations `leads_origem_rd_station` e
-- `leads_whatsapp_opcional_e_fonte`. Ver docs/HANDOFF.md §24.
-- ============================================================================

-- ─── Origem nova: RD Station CRM ────────────────────────────────────────────
-- A RD passa a ser a fonte única de lead de anúncio (a integração do Meta vive
-- dentro dela). `meta_ads` continua válido como legado dos 22 leads importados
-- direto do Meta antes dessa decisão.
alter table public.leads drop constraint leads_origem_valida;
alter table public.leads add constraint leads_origem_valida
  check (origem = any (array['site','meta_ads','rd_station','whatsapp','indicacao','evento','outro']));

-- Índice para a deduplicação por e-mail do webhook da RD. Sem ele, cada lead
-- recebido faria varredura na tabela inteira — e a RD dá 5 segundos de prazo
-- antes de reenviar.
create index if not exists leads_email_lower_idx on public.leads (lower(email));

comment on constraint leads_origem_valida on public.leads is
  'meta_ads = importação/webhook direto do Meta (legado). rd_station = webhook da RD Station CRM, fonte atual.';

-- ─── Telefone deixa de ser obrigatório ──────────────────────────────────────
-- 3 leads reais vindos de Google Ads existem na RD só com e-mail. Lead com
-- e-mail ainda é lead — e já havia precedente: 2 leads do Meta têm telefone de
-- 10 dígitos que não funciona no WhatsApp.
-- O formulário do site continua exigindo telefone NA PÁGINA; a obrigatoriedade
-- cai só no banco.
alter table public.leads alter column whatsapp drop not null;

alter table public.leads drop constraint leads_whatsapp_tamanho;
alter table public.leads add constraint leads_whatsapp_tamanho
  check (whatsapp is null or (char_length(whatsapp) >= 8 and char_length(whatsapp) <= 30));

-- Lead tem que ter PELO MENOS um canal. Sem isto, a coluna nula abre espaço
-- para linha sem e-mail e sem telefone, que não é lead — é ruído.
alter table public.leads add constraint leads_tem_algum_contato
  check (email is not null or whatsapp is not null);

-- ─── Coluna de fonte, separada de campanha ──────────────────────────────────
-- Decisão deliberada: NÃO sobrescreve `campanha`/`conjunto`/`anuncio`, que nos
-- leads do Meta guardam o criativo. A RD traz outra camada — o canal
-- ("Busca Paga | Facebook Ads", "Busca Paga | Google", "Referência | linktr.ee").
-- Foi por essa coluna que se descobriu que existe Google Ads rodando, coisa
-- que não estava documentada em lugar nenhum do projeto.
alter table public.leads add column fonte text;
alter table public.leads add constraint leads_fonte_tamanho
  check (fonte is null or char_length(fonte) <= 120);

comment on column public.leads.fonte    is 'Canal de origem segundo a RD (ex.: Busca Paga | Facebook Ads). Camada acima de campanha/conjunto/anuncio, que guardam o criativo do Meta.';
comment on column public.leads.whatsapp is 'Opcional desde 03/ago: lead de Google Ads via RD costuma vir só com e-mail.';
