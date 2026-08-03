-- ============================================================================
-- Leads de tráfego pago (Meta Ads) na mesma tabela dos leads do site
-- Aplicada em produção via Supabase MCP em 03/ago/2026.
-- Ver docs/HANDOFF.md §20.
--
-- Contexto: existiam dois lugares para lead — a tabela `leads` (formulário do
-- site) e uma planilha do Google alimentada pelo Meta Lead Ads, com um painel
-- Cowork por cima guardando estado em localStorage. Esta migration unifica:
-- o lead do Meta passa a viver na tabela `leads` e é trabalhado na tela
-- /leads do admin, que já existia.
-- ============================================================================

-- Origem nova: leads de tráfego pago do Meta (Instagram/Facebook Lead Ads).
alter table public.leads drop constraint leads_origem_valida;
alter table public.leads add constraint leads_origem_valida
  check (origem = any (array['site','meta_ads','whatsapp','indicacao','evento','outro']));

-- Rastreio de campanha. Só preenchido em leads de tráfego pago; nulo no
-- formulário do site.
alter table public.leads
  add column external_id text,
  add column campanha    text,
  add column conjunto    text,
  add column anuncio     text,
  add column plataforma  text;

-- Idempotência da importação: o id do lead no Meta é único e nunca muda.
-- Índice parcial porque lead de site não tem external_id — um índice único
-- comum trataria os nulos como colisão em alguns cenários e, pior, obrigaria
-- a inventar valor para quem vem do site.
create unique index leads_external_id_unico
  on public.leads (external_id) where external_id is not null;

alter table public.leads
  add constraint leads_campos_campanha_tamanho check (
    (campanha    is null or char_length(campanha)    <= 200) and
    (conjunto    is null or char_length(conjunto)    <= 200) and
    (anuncio     is null or char_length(anuncio)     <= 200) and
    (plataforma  is null or char_length(plataforma)  <= 40)  and
    (external_id is null or char_length(external_id) <= 80)
  );

comment on column public.leads.external_id is 'ID do lead no sistema de origem (ex.: l:1775484823699615 no Meta). Garante importação idempotente.';
comment on column public.leads.plataforma  is 'Plataforma de origem do anúncio: instagram | facebook.';

-- ----------------------------------------------------------------------------
-- O título da notificação dizia "do site" fixo. Com origem nova, todo lead do
-- Meta apareceria como "do site" no feed do admin.
--
-- ⚠️ Este trigger é AFTER INSERT: carga em massa gera uma notificação por
-- linha, datada de hoje, para leads antigos. Na importação dos 22 leads do
-- Meta foram 22 notificações de ruído, apagadas depois. Em nova carga em
-- massa, desabilitar o trigger na transação ou limpar em seguida.
-- ----------------------------------------------------------------------------
create or replace function public.notify_lead_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  origem_label text := CASE NEW.origem
    WHEN 'site'      THEN 'do site'
    WHEN 'meta_ads'  THEN 'do Meta Ads'
    WHEN 'whatsapp'  THEN 'do WhatsApp'
    WHEN 'indicacao' THEN 'por indicação'
    WHEN 'evento'    THEN 'de evento'
    ELSE 'novo'
  END;
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, metadata)
  VALUES (
    'lead_received',
    'Novo lead ' || origem_label || ': ' || NEW.nome,
    NEW.whatsapp || ' · ' || NEW.email,
    jsonb_build_object(
      'lead_id', NEW.id,
      'nome', NEW.nome,
      'whatsapp', NEW.whatsapp,
      'email', NEW.email,
      'especialidade', NEW.especialidade,
      'origem', NEW.origem
    )
  );
  RETURN NEW;
END;
$$;
