-- Recebimentos em dinheiro registrados pelo admin (pagamento fora do Asaas).
-- Cada recebimento ativa o que foi pago (plano PRO ou pacote de horas) na mesma
-- transação, espelhando o efeito do asaas-webhook ao confirmar um pagamento.

create table public.cash_receipts (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id),
  tipo            text not null check (tipo in ('plano', 'pacote_horas')),
  valor           numeric(12,2) not null check (valor > 0),
  recebido_em     date not null,
  plan_id         uuid references public.plans(id),
  ciclo           text check (ciclo in ('mensal', 'semestral')),
  meses_cobertos  integer check (meses_cobertos >= 1),
  package_id      uuid references public.hour_packages(id),
  subscription_id uuid references public.subscriptions(id),
  hour_balance_id uuid references public.hour_balance(id),
  observacoes     text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index cash_receipts_recebido_em_idx on public.cash_receipts (recebido_em desc);
create index cash_receipts_professional_idx on public.cash_receipts (professional_id);

alter table public.cash_receipts enable row level security;

create policy "cash_receipts_admin" on public.cash_receipts
  for all using (public.is_oli_admin()) with check (public.is_oli_admin());

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

  return v_id;
end;
$$;

-- Só o service role (server actions do admin) executa; nunca o app do médico.
revoke all on function public.register_cash_receipt(uuid, text, numeric, date, uuid, text, integer, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.register_cash_receipt(uuid, text, numeric, date, uuid, text, integer, uuid, text, uuid)
  to service_role;
