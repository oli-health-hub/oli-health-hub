-- Reverte o "cadastro sem plano" de 19/ago (§31): todo cadastro novo volta a
-- nascer no START, com assinatura ativa. Decisão do fundador em 26/ago —
-- "quem está sem plano é START, não existe cadastro sem plano".
--
-- O default da coluna volta como rede de segurança para qualquer INSERT que
-- não passe por esta função. `taxa_min_congelada` continua NULL de propósito:
-- perfil novo usa a taxa viva do catálogo (R$ 1,90), o congelamento é só para
-- quem já estava dentro antes da reforma.
alter table profiles alter column plan set default 'START';

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

  insert into public.profiles (id, nome, plan, plan_id, user_type)
  values (
    p_user_id,
    coalesce(p_nome, split_part(p_email, '@', 1)),
    case when v_start_plan_id is null then null else 'START' end,
    v_start_plan_id,
    p_user_type
  )
  on conflict (id) do nothing;

  -- Idempotente de propósito: se o profissional já tem qualquer assinatura,
  -- não cria outra. A Claudia Moraes ficou com 2 linhas por falta desta
  -- guarda na versão antiga.
  if v_start_plan_id is not null
     and not exists (select 1 from subscriptions where professional_id = p_user_id) then
    insert into subscriptions (professional_id, plan_id, ciclo, status, starts_at)
    values (p_user_id, v_start_plan_id, 'mensal', 'active', now());
  end if;
end;
$function$;
