-- Promoções: benefício (horas bônus) concedido quando uma condição de produto é
-- cumprida. Diferente de cupom (que dá desconto no preço).
--
-- Exemplo: "PRO mensal reverte em 6 horas de utilização".
--
-- Aplicação automática hoje: recebimento em dinheiro (register_cash_receipt).
-- Pagamentos via Asaas (asaas-webhook) ainda NÃO aplicam promoção: a função
-- apply_promotions já está pronta para o webhook chamar, mas o webhook precisa
-- ser alterado e republicado (origem = 'asaas', origem_ref = id do pagamento).

create table public.promotions (
  id                       uuid primary key default gen_random_uuid(),
  nome                     text not null check (char_length(btrim(nome)) >= 3),
  descricao                text,
  ativo                    boolean not null default true,
  vigencia_inicio          date,
  vigencia_fim             date,
  -- Condição de produto
  aplica_a                 text not null check (aplica_a in ('plano', 'pacote_horas')),
  plan_id                  uuid references public.plans(id),
  ciclo                    text check (ciclo in ('mensal', 'semestral')),   -- null = qualquer ciclo
  package_id               uuid references public.hour_packages(id),        -- null = qualquer pacote
  -- Benefício
  horas_bonus              numeric(6,2) not null check (horas_bonus > 0),
  validade_dias            integer not null default 365 check (validade_dias > 0),
  -- Limites
  uma_vez_por_profissional boolean not null default false,
  limite_usos              integer check (limite_usos > 0),                 -- null = ilimitado
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  constraint promotions_plano_exige_plan check (aplica_a <> 'plano' or plan_id is not null),
  constraint promotions_vigencia_ordem   check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio)
);

create table public.promotion_redemptions (
  id              uuid primary key default gen_random_uuid(),
  promotion_id    uuid not null references public.promotions(id),
  professional_id uuid not null references public.profiles(id),
  origem          text not null check (origem in ('dinheiro', 'asaas')),
  origem_ref      text not null,            -- id do cash_receipt ou do pagamento Asaas
  minutos         integer not null check (minutos > 0),
  hour_balance_id uuid references public.hour_balance(id),
  estornado_em    timestamptz,
  created_at      timestamptz not null default now(),
  unique (promotion_id, origem, origem_ref)  -- idempotência: o mesmo pagamento não rende duas vezes
);

create index promotion_redemptions_professional_idx on public.promotion_redemptions (professional_id);

alter table public.promotions            enable row level security;
alter table public.promotion_redemptions enable row level security;

create policy "promotions_admin" on public.promotions
  for all using (public.is_oli_admin()) with check (public.is_oli_admin());
create policy "promotion_redemptions_admin" on public.promotion_redemptions
  for all using (public.is_oli_admin()) with check (public.is_oli_admin());

-- Concede as horas de toda promoção ativa que casar com o produto pago.
-- Devolve o total de minutos creditados (0 se nenhuma casou).
create or replace function public.apply_promotions(
  p_professional_id uuid,
  p_aplica_a        text,
  p_plan_id         uuid,
  p_ciclo           text,
  p_package_id      uuid,
  p_origem          text,
  p_origem_ref      text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  pr      record;
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_total integer := 0;
  v_min   integer;
  v_bal   uuid;
  v_usos  integer;
begin
  for pr in
    select * from promotions
     where ativo
       and aplica_a = p_aplica_a
       and (vigencia_inicio is null or vigencia_inicio <= v_hoje)
       and (vigencia_fim    is null or vigencia_fim    >= v_hoje)
       and (p_aplica_a <> 'plano'        or (plan_id = p_plan_id and (ciclo is null or ciclo = p_ciclo)))
       and (p_aplica_a <> 'pacote_horas' or (package_id is null or package_id = p_package_id))
     order by created_at
  loop
    continue when exists (
      select 1 from promotion_redemptions
       where promotion_id = pr.id and origem = p_origem and origem_ref = p_origem_ref
    );

    if pr.uma_vez_por_profissional and exists (
      select 1 from promotion_redemptions
       where promotion_id = pr.id and professional_id = p_professional_id and estornado_em is null
    ) then
      continue;
    end if;

    if pr.limite_usos is not null then
      select count(*) into v_usos from promotion_redemptions
       where promotion_id = pr.id and estornado_em is null;
      if v_usos >= pr.limite_usos then
        continue;
      end if;
    end if;

    v_min := round(pr.horas_bonus * 60);

    insert into hour_balance (professional_id, minutos_total, minutos_usados, expira_em)
    values (p_professional_id, v_min, 0, now() + make_interval(days => pr.validade_dias))
    returning id into v_bal;

    insert into promotion_redemptions (promotion_id, professional_id, origem, origem_ref, minutos, hour_balance_id)
    values (pr.id, p_professional_id, p_origem, p_origem_ref, v_min, v_bal);

    v_total := v_total + v_min;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.apply_promotions(uuid, text, uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_promotions(uuid, text, uuid, text, uuid, text, text) to service_role;

-- register_cash_receipt: agora aplica as promoções ao final (mesma transação).
create or replace function public.register_cash_receipt(
  p_professional_id uuid,
  p_tipo            text,
  p_valor           numeric,
  p_recebido_em     date,
  p_plan_id         uuid,
  p_ciclo           text,
  p_meses           integer,
  p_package_id      uuid,
  p_observacoes     text,
  p_created_by      uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_sub       uuid;
  v_bal       uuid;
  v_plan_name text;
  v_meses     integer;
  v_horas     numeric;
  v_bonus     numeric;
  v_validade  integer;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor deve ser maior que zero';
  end if;

  perform 1 from profiles where id = p_professional_id;
  if not found then
    raise exception 'Profissional não encontrado';
  end if;

  if p_tipo = 'plano' then
    if p_ciclo is null or p_ciclo not in ('mensal', 'semestral') then
      raise exception 'Ciclo inválido';
    end if;

    select name into v_plan_name from plans where id = p_plan_id and ativo;
    if not found then
      raise exception 'Plano não encontrado ou inativo';
    end if;

    v_meses := greatest(coalesce(p_meses, 1), 1);

    insert into subscriptions (professional_id, plan_id, ciclo, status, starts_at, ends_at, fidelidade_ate)
    values (
      p_professional_id, p_plan_id, p_ciclo, 'active', now(),
      now() + make_interval(months => v_meses),
      case when p_ciclo = 'semestral' then (now() + interval '183 days')::date end
    )
    returning id into v_sub;

    update profiles
       set plan = v_plan_name, plan_id = p_plan_id, pre_paid_ok = true
     where id = p_professional_id;

  elsif p_tipo = 'pacote_horas' then
    select horas, coalesce(bonus_horas, 0), validade_dias
      into v_horas, v_bonus, v_validade
      from hour_packages where id = p_package_id and ativo;
    if not found then
      raise exception 'Pacote não encontrado ou inativo';
    end if;

    insert into hour_balance (professional_id, package_id, minutos_total, minutos_usados, expira_em)
    values (
      p_professional_id, p_package_id, ((v_horas + v_bonus) * 60)::integer, 0,
      now() + make_interval(days => v_validade)
    )
    returning id into v_bal;

  else
    raise exception 'Tipo inválido';
  end if;

  insert into cash_receipts (
    professional_id, tipo, valor, recebido_em, plan_id, ciclo, meses_cobertos,
    package_id, subscription_id, hour_balance_id, observacoes, created_by
  ) values (
    p_professional_id, p_tipo, p_valor, p_recebido_em,
    case when p_tipo = 'plano' then p_plan_id end,
    case when p_tipo = 'plano' then p_ciclo end,
    case when p_tipo = 'plano' then v_meses end,
    case when p_tipo = 'pacote_horas' then p_package_id end,
    v_sub, v_bal, nullif(trim(p_observacoes), ''), p_created_by
  )
  returning id into v_id;

  perform apply_promotions(
    p_professional_id,
    case when p_tipo = 'plano' then 'plano' else 'pacote_horas' end,
    p_plan_id, p_ciclo, p_package_id,
    'dinheiro', v_id::text
  );

  return v_id;
end;
$$;

-- reverse_cash_receipt: o estorno também desfaz as horas das promoções concedidas.
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
  rd           record;
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
    update hour_balance
       set minutos_total = case when minutos_usados > 0 then minutos_usados else minutos_total end,
           expira_em     = case when minutos_usados > 0 then expira_em else now() end
     where id = r.hour_balance_id;
  end if;

  -- Horas de promoção concedidas por este recebimento: retira o que não foi usado.
  for rd in
    select id, hour_balance_id from promotion_redemptions
     where origem = 'dinheiro' and origem_ref = p_receipt_id::text and estornado_em is null
  loop
    update hour_balance
       set minutos_total = case when minutos_usados > 0 then minutos_usados else minutos_total end,
           expira_em     = case when minutos_usados > 0 then expira_em else now() end
     where id = rd.hour_balance_id;
    update promotion_redemptions set estornado_em = now() where id = rd.id;
  end loop;

  update cash_receipts
     set estornado_em = now(), estorno_motivo = btrim(p_motivo), estornado_por = p_created_by
   where id = p_receipt_id;
end;
$$;
