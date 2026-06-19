-- ── Cupons de desconto ──────────────────────────────────────────────────────
create table if not exists coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  tipo            text not null check (tipo in ('percentual','fixo')),
  valor           numeric(10,2) not null check (valor > 0),
  aplicavel_a     text not null default 'todos' check (aplicavel_a in ('modulos','planos','pacotes','todos')),
  plano_recorrente boolean not null default false,  -- true = desconto em todas as faturas do plano; false = só 1ª
  validade        timestamptz,                       -- null = sem expiração
  limite_uso      integer check (limite_uso is null or limite_uso > 0),
  usos            integer not null default 0,
  ativo           boolean not null default true,
  descricao       text,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create unique index if not exists coupons_code_upper_idx on coupons (upper(code));

-- ── Resgates (auditoria + limite por usuário) ───────────────────────────────
create table if not exists coupon_redemptions (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references coupons(id),
  professional_id uuid not null references profiles(id),
  target_type     text not null,                     -- 'modulo' | 'plano' | 'pacote'
  target_ref      text,                              -- slug / plan_id / horas
  base_value      numeric(10,2) not null,
  desconto        numeric(10,2) not null,
  valor_final     numeric(10,2) not null,
  asaas_id        text,                              -- charge/subscription id
  status          text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at      timestamptz not null default now()
);
create index if not exists coupon_redemptions_prof_coupon_idx on coupon_redemptions (professional_id, coupon_id);
create index if not exists coupon_redemptions_asaas_idx on coupon_redemptions (asaas_id);

alter table coupons enable row level security;
alter table coupon_redemptions enable row level security;

-- ── RPC: valida cupom + calcula desconto (NÃO incrementa uso) ────────────────
create or replace function validate_coupon(
  p_code            text,
  p_target_type     text,        -- 'modulo' | 'plano' | 'pacote'
  p_base_value      numeric,
  p_professional_id uuid default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  c          coupons%rowtype;
  v_aplic    text;
  v_desconto numeric(10,2);
  v_final    numeric(10,2);
  v_used     integer;
begin
  select * into c from coupons where upper(code) = upper(p_code) and ativo limit 1;
  if not found then return json_build_object('valid', false, 'error', 'Cupom inválido'); end if;
  if c.validade is not null and c.validade < now() then
    return json_build_object('valid', false, 'error', 'Cupom expirado');
  end if;
  if c.limite_uso is not null and c.usos >= c.limite_uso then
    return json_build_object('valid', false, 'error', 'Cupom esgotado');
  end if;

  v_aplic := case p_target_type
    when 'modulo' then 'modulos'
    when 'plano'  then 'planos'
    when 'pacote' then 'pacotes'
    else p_target_type end;
  if c.aplicavel_a <> 'todos' and c.aplicavel_a <> v_aplic then
    return json_build_object('valid', false, 'error', 'Cupom não aplicável a este item');
  end if;

  if p_professional_id is not null then
    select count(*) into v_used from coupon_redemptions
      where coupon_id = c.id and professional_id = p_professional_id and status <> 'cancelled';
    if v_used > 0 then return json_build_object('valid', false, 'error', 'Cupom já utilizado'); end if;
  end if;

  if c.tipo = 'percentual' then
    v_desconto := round(p_base_value * c.valor / 100, 2);
  else
    v_desconto := least(c.valor, p_base_value);
  end if;
  v_final := p_base_value - v_desconto;

  -- Asaas: mínimo R$5 por cobrança
  if v_final < 5 then
    return json_build_object('valid', false, 'error', 'Valor final abaixo do mínimo de R$5,00');
  end if;

  return json_build_object(
    'valid', true,
    'coupon_id', c.id,
    'tipo', c.tipo,
    'valor', c.valor,
    'desconto', v_desconto,
    'valor_final', v_final,
    'plano_recorrente', c.plano_recorrente
  );
end; $$;

grant execute on function validate_coupon(text, text, numeric, uuid) to anon, authenticated, service_role;
