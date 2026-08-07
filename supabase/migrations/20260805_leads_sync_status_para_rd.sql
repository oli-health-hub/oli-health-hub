-- ============================================================================
-- Volta da informação para a RD Station CRM
-- Aplicada em produção via Supabase MCP em 05/ago/2026. Ver docs/HANDOFF.md §25.
--
-- Decisão do fundador: o PAINEL é a fonte de verdade do status. A equipe não
-- mexe no funil da RD; tudo que muda aqui tem que mudar lá.
-- ============================================================================

-- Sem o id da NEGOCIAÇÃO não há o que mover: o que estava guardado até aqui
-- (`external_id = rd_contact:...`) é o id do CONTATO, e contato não anda no
-- funil da RD — quem anda é a negociação.
alter table public.leads
  add column rd_deal_id text,
  add column rd_sync_em timestamptz,
  add column rd_sync_erro text;

comment on column public.leads.rd_deal_id   is 'ID da negociação na RD CRM. É a negociação que se move entre etapas — o contato não.';
comment on column public.leads.rd_sync_em   is 'Quando o status foi espelhado na RD com sucesso.';
comment on column public.leads.rd_sync_erro is 'Última falha ao espelhar. Nulo = ok. Serve para a falha não passar despercebida.';

-- ----------------------------------------------------------------------------
-- Mapa etapa do painel → etapa da RD, em TABELA e não em código: é regra de
-- negócio e muda sem deploy. Mesmo padrão de partner_commission_config.
--
-- O funil da RD ("Funil Padrão") bate quase 1:1 com a esteira do painel —
-- 7 das 9 etapas têm par exato.
-- ----------------------------------------------------------------------------
create table public.rd_stage_map (
  status        text primary key,
  rd_stage_id   text not null,
  rd_stage_nome text not null,
  observacao    text
);

comment on table public.rd_stage_map is
  'Tradução do status do painel para a etapa do Funil Padrão da RD. Editável por UPDATE — não exige deploy.';

insert into public.rd_stage_map (status, rd_stage_id, rd_stage_nome, observacao) values
  ('novo',               '69fcdc5c04455d001de4c47c', 'Novo lead',         null),
  ('contatado',          '69fcdc5c04455d001de4c47d', 'Contato realizado', null),
  -- As duas abaixo não têm par na RD: foram criadas no painel a pedido do
  -- fundador e o Funil Padrão não tem equivalente. Ambas caem em "Contato
  -- realizado" porque em ambas já houve tentativa de contato.
  ('sem_resposta',       '69fcdc5c04455d001de4c47d', 'Contato realizado', 'Sem par na RD — houve tentativa, por isso Contato realizado.'),
  ('aguardando_retorno', '69fcdc5c04455d001de4c47d', 'Contato realizado', 'Sem par na RD — houve tentativa, por isso Contato realizado.'),
  ('visita_agendada',    '69fcdc5c04455d001de4c47e', 'Visita agendada',   null),
  ('visita_realizada',   '69fcdc5c04455d001de4c47f', 'Visita realizada',  null),
  ('proposta_enviada',   '69fcdc5c04455d001de4c480', 'Proposta enviada',  null),
  ('convertido',         '6a164f9c34f9de0021646b2a', 'Contrato fechado',  null),
  ('descartado',         '6a1651814657c7001ecc81bc', 'Perdido',           null);

alter table public.rd_stage_map enable row level security;
create policy "rd_stage_map admin" on public.rd_stage_map
  for all using (public.is_oli_admin()) with check (public.is_oli_admin());

-- ----------------------------------------------------------------------------
-- Trigger: dispara no BANCO, não na server action do admin.
-- Assim QUALQUER caminho que mude o status (tela, SQL, código futuro,
-- importação) espelha na RD. Amarrar na action cobriria só a tela.
-- ----------------------------------------------------------------------------
create or replace function public.sync_lead_status_para_rd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_url text;
begin
  -- Sem negociação na RD não há o que mover (ex.: lead do formulário do site).
  if new.rd_deal_id is null then
    return new;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'supabase_url'      limit 1;

  if v_key is null or v_url is null then
    raise notice 'Vault sem service_role_key/supabase_url — status não espelhado na RD';
    return new;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/rd-sync-status',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body    := jsonb_build_object('leadId', new.id),
    timeout_milliseconds := 15000
  );

  return new;
end;
$$;

-- WHEN com IS DISTINCT FROM: salvar só a observação não deve gerar chamada à RD.
create trigger trg_lead_status_para_rd
  after update of status on public.leads
  for each row
  when (old.status is distinct from new.status)
  execute function public.sync_lead_status_para_rd();

comment on function public.sync_lead_status_para_rd() is
  'Espelha na RD CRM a mudança de etapa feita no painel. Assíncrono via pg_net — o resultado volta em leads.rd_sync_em / rd_sync_erro.';
