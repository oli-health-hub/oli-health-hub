-- profiles nunca teve coluna email — o e-mail do cadastro ia só pro Auth
-- (auth.users.email); _create_profile_and_subscription recebia p_email só
-- pra usar como fallback de nome (split_part antes do @) e nunca gravava.
-- Resultado: e-mail inacessível pro admin/CRM via profiles, só dentro do Auth.
alter table profiles add column if not exists email text;

create or replace function public._create_profile_and_subscription(
  p_user_id uuid,
  p_email text,
  p_nome text default null,
  p_user_type text default 'subscriber'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_start_plan_id uuid;
begin
  select id into v_start_plan_id from plans where name = 'START' and ativo limit 1;

  insert into public.profiles (id, nome, email, plan, plan_id, user_type)
  values (
    p_user_id,
    coalesce(p_nome, split_part(p_email, '@', 1)),
    p_email,
    case when v_start_plan_id is null then null else 'START' end,
    v_start_plan_id,
    p_user_type
  )
  on conflict (id) do nothing;

  if v_start_plan_id is not null
     and not exists (select 1 from subscriptions where professional_id = p_user_id) then
    insert into subscriptions (professional_id, plan_id, ciclo, status, starts_at)
    values (p_user_id, v_start_plan_id, 'mensal', 'active', now());
  end if;
end;
$function$;

-- Backfill: quem já tem profile com email nulo recebe o e-mail direto do Auth.
update profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;
