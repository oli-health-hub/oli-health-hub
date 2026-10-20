-- Remoção de horas pelo admin, com motivo e aviso registrados, e estorno de
-- recebimento em dinheiro.

-- ── Remoção de horas ─────────────────────────────────────────────────────────

create table public.hour_adjustments (
  id                  uuid primary key default gen_random_uuid(),
  professional_id     uuid not null references public.profiles(id),
  minutos_removidos   integer not null check (minutos_removidos > 0),
  motivo              text not null check (char_length(btrim(motivo)) >= 10),
  mensagem            text not null,
  -- Quais pacotes foram reduzidos e quanto: [{ "hour_balance_id": ..., "minutos": ... }]
  detalhe             jsonb not null,
  push_status         text not null default 'pendente'
                        check (push_status in ('pendente', 'enviado', 'sem_dispositivo', 'falhou')),
  whatsapp_enviado_em timestamptz,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create index hour_adjustments_professional_idx on public.hour_adjustments (professional_id, created_at desc);

alter table public.hour_adjustments enable row level security;

create policy "hour_adjustments_admin" on public.hour_adjustments
  for all using (public.is_oli_admin()) with check (public.is_oli_admin());

-- Tira minutos do saldo NÃO expirado, consumindo primeiro o pacote que vence antes.
-- Reduz minutos_total (nunca abaixo de minutos_usados), então o app continua
-- calculando saldo = total - usado sem nenhuma mudança.
create or replace function public.remove_hours(
  p_professional_id uuid,
  p_minutos         integer,
  p_motivo          text,
  p_mensagem        text,
  p_created_by      uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left  integer := p_minutos;
  v_avail integer;
  v_take  integer;
  v_det   jsonb := '[]'::jsonb;
  v_id    uuid;
  r       record;
begin
  if p_minutos is null or p_minutos <= 0 then
    raise exception 'Informe uma quantidade de horas maior que zero';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 10 then
    raise exception 'Informe o motivo (mínimo de 10 caracteres)';
  end if;
  if p_mensagem is null or btrim(p_mensagem) = '' then
    raise exception 'Mensagem de aviso obrigatória';
  end if;

  perform 1 from profiles where id = p_professional_id;
  if not found then
    raise exception 'Profissional não encontrado';
  end if;

  select coalesce(sum(minutos_total - minutos_usados), 0) into v_avail
    from hour_balance
   where professional_id = p_professional_id
     and expira_em > now()
     and minutos_total > minutos_usados;

  if p_minutos > v_avail then
    raise exception 'Saldo disponível (% min) é menor que o solicitado (% min)', v_avail, p_minutos;
  end if;

  for r in
    select id, minutos_total, minutos_usados
      from hour_balance
     where professional_id = p_professional_id
       and expira_em > now()
       and minutos_total > minutos_usados
     order by expira_em asc, created_at asc
       for update
  loop
    exit when v_left = 0;
    v_take := least(v_left, r.minutos_total - r.minutos_usados);

    -- hour_balance exige minutos_total > 0: pacote esvaziado sem nenhum uso é
    -- expirado em vez de zerado (o app só conta pacotes não expirados).
    if r.minutos_total - v_take > 0 then
      update hour_balance set minutos_total = minutos_total - v_take where id = r.id;
    else
      update hour_balance set expira_em = now() where id = r.id;
    end if;

    v_det  := v_det || jsonb_build_object('hour_balance_id', r.id, 'minutos', v_take);
    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    raise exception 'Saldo mudou durante a operação; tente novamente';
  end if;

  insert into hour_adjustments (professional_id, minutos_removidos, motivo, mensagem, detalhe, created_by)
  values (p_professional_id, p_minutos, btrim(p_motivo), btrim(p_mensagem), v_det, p_created_by)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.remove_hours(uuid, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.remove_hours(uuid, integer, text, text, uuid) to service_role;

-- ── Estorno de recebimento em dinheiro ───────────────────────────────────────

alter table public.cash_receipts
  add column estornado_em   timestamptz,
  add column estorno_motivo text,
  add column estornado_por  uuid references public.profiles(id);

-- Desfaz o que o recebimento ativou e o tira do fluxo de caixa (a linha fica
-- para auditoria, marcada como estornada).
create or replace function public.reverse_cash_receipt(
  p_receipt_id uuid,
  p_motivo     text,
  p_created_by uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r            cash_receipts%rowtype;
  v_prev_id    uuid;
  v_prev_name  text;
begin
  if p_motivo is null or char_length(btrim(p_motivo)) < 5 then
    raise exception 'Informe o motivo do estorno (mínimo de 5 caracteres)';
  end if;

  select * into r from cash_receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'Recebimento não encontrado';
  end if;
  if r.estornado_em is not null then
    raise exception 'Recebimento já estornado';
  end if;

  if r.tipo = 'plano' then
    update subscriptions
       set status = 'cancelled', cancelled_at = now()
     where id = r.subscription_id;

    -- Volta o perfil para o plano da assinatura ativa mais recente que sobrar
    -- (todo assinante START tem uma); sem nenhuma, cai no START.
    select s.plan_id, p.name into v_prev_id, v_prev_name
      from subscriptions s
      join plans p on p.id = s.plan_id
     where s.professional_id = r.professional_id
       and s.status = 'active'
       and s.id <> r.subscription_id
     order by s.starts_at desc
     limit 1;

    update profiles
       set plan    = coalesce(v_prev_name, 'START'),
           plan_id = coalesce(v_prev_id, (select id from plans where name = 'START' limit 1))
     where id = r.professional_id;
  else
    -- Tira o que restava do pacote; o que já foi usado permanece. Sem nenhum uso,
    -- expira a linha (hour_balance exige minutos_total > 0).
    update hour_balance
       set minutos_total = case when minutos_usados > 0 then minutos_usados else minutos_total end,
           expira_em     = case when minutos_usados > 0 then expira_em else now() end
     where id = r.hour_balance_id;
  end if;

  update cash_receipts
     set estornado_em = now(), estorno_motivo = btrim(p_motivo), estornado_por = p_created_by
   where id = p_receipt_id;
end;
$$;

revoke all on function public.reverse_cash_receipt(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reverse_cash_receipt(uuid, text, uuid) to service_role;
