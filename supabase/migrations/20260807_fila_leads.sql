-- ============================================================================
-- Fila de Trabalho: título correto do lead + baixa ao trabalhar
-- Aplicadas em produção via Supabase MCP em 07/ago/2026.
-- Reconstitui `fix_notify_lead_created_rd_station` e `lead_trabalhado_sai_da_fila`.
-- Ver docs/HANDOFF.md §27.
-- ============================================================================

-- ─── 1. Título "Novo lead novo: Fulano" ─────────────────────────────────────
-- Bug introduzido em 03/ago: a origem `rd_station` foi criada DEPOIS desta
-- função e nunca entrou no CASE, caindo no ELSE 'novo'.
--
-- De brinde, o `body` também estava quebrado: `whatsapp || ' · ' || email`
-- vira NULL inteiro quando whatsapp é nulo (regra de concatenação do SQL).
-- Desde que o telefone virou opcional (§24), lead de Google Ads gravava corpo
-- vazio. Resolvido com coalesce.
create or replace function public.notify_lead_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  origem_label text := CASE NEW.origem
    WHEN 'site'       THEN 'do site'
    WHEN 'rd_station' THEN 'da RD Station'
    WHEN 'meta_ads'   THEN 'do Meta Ads'
    WHEN 'whatsapp'   THEN 'do WhatsApp'
    WHEN 'indicacao'  THEN 'por indicação'
    WHEN 'evento'     THEN 'de evento'
    ELSE 'novo'
  END;
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, metadata)
  VALUES (
    'lead_received',
    'Novo lead ' || origem_label || ': ' || NEW.nome,
    coalesce(NEW.whatsapp || ' · ', '') || NEW.email,
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

update public.admin_notifications
set title = replace(title, 'Novo lead novo: ', 'Novo lead da RD Station: ')
where type = 'lead_received'
  and title like 'Novo lead novo: %'
  and metadata->>'origem' = 'rd_station';

-- ─── 2. Lead trabalhado sai da Fila ─────────────────────────────────────────
-- A Fila mostra `admin_notifications` com `read_at is null`. Lead já contatado
-- continuava lá e a fila só crescia — 76 itens quando isto foi escrito.
--
-- No banco, não na server action: vale para qualquer caminho que mude o status.
create or replace function public.baixa_fila_ao_trabalhar_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sair de 'novo' significa que alguém pegou o lead. Qualquer etapa serve,
  -- inclusive 'descartado' — descartar também é trabalhar.
  -- Só dá baixa, nunca ressuscita: voltar para 'novo' não deve fazer o item
  -- reaparecer, senão a fila vira ioiô.
  if new.status <> 'novo' then
    update public.admin_notifications
    set read_at = now()
    where type = 'lead_received'
      and read_at is null
      and metadata->>'lead_id' = new.id::text;
  end if;
  return new;
end;
$$;

create trigger trg_lead_trabalhado_sai_da_fila
  after update of status on public.leads
  for each row
  when (old.status is distinct from new.status)
  execute function public.baixa_fila_ao_trabalhar_lead();

comment on function public.baixa_fila_ao_trabalhar_lead() is
  'Marca como lida a notificação de lead quando ele sai de "novo" — tira da Fila de Trabalho o que já está sendo tratado.';

-- Limpeza retroativa do que já estava trabalhado antes deste trigger existir.
update public.admin_notifications n
set read_at = now()
from public.leads l
where n.type = 'lead_received'
  and n.read_at is null
  and n.metadata->>'lead_id' = l.id::text
  and l.status <> 'novo';
