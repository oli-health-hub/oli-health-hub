-- ─────────────────────────────────────────────────────────────────────────────
-- Módulos contratados por profissional
-- Registra quais add-ons cada médico contratou além do seu plano.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists user_modules (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references profiles(id) on delete cascade,
  module_id    text        not null,
  status       text        not null default 'pending_payment'
                           check (status in (
                             'pending_payment',
                             'pending_config',
                             'active',
                             'suspended',
                             'cancelled'
                           )),
  activated_at timestamptz,
  expires_at   timestamptz,
  config       jsonb       not null default '{}',
  contract_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Um profissional só pode ter um registro por módulo
  unique (user_id, module_id)
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

create index if not exists user_modules_user_id_idx
  on user_modules (user_id);

create index if not exists user_modules_status_idx
  on user_modules (status);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table user_modules enable row level security;

-- Médico vê e gerencia apenas os próprios módulos
create policy "user_modules: leitura própria"
  on user_modules for select
  using (auth.uid() = user_id);

create policy "user_modules: inserção própria"
  on user_modules for insert
  with check (auth.uid() = user_id);

create policy "user_modules: atualização própria"
  on user_modules for update
  using (auth.uid() = user_id);

-- ─── updated_at automático ───────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_modules_updated_at
  before update on user_modules
  for each row execute function set_updated_at();
