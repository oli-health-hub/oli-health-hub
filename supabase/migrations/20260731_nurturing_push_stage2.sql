-- Régua de nurturing via push — fatia 2 (estágios 4.2 a 4.8 do
-- OLI_Nurturing_Push.docx, exceto os gatilhos bloqueados por dependência de
-- produto: nudge_checkin e parabens_primeiro_atendimento (fluxo de check-in
-- ainda não desenhado) e fatura_disponivel (não existe hoje um evento de
-- "fatura gerada" no app — faturamento é agregado client-side em Financeiro).
--
-- Aplicado via Supabase MCP em 7 migrations separadas nesta sessão:
--   nurturing_profile_faltam_helper_and_perfil_100
--   nurturing_conquista_desbloqueada_trigger
--   nurturing_saldo_baixo_horas_trigger
--   nurturing_indicacao_confirmada_push
--   nurturing_reacao_inatividade_30d + nurturing_fix_grammar_14d_copy
--   nurturing_new_cron_functions
--   nurturing_schedule_new_crons
-- Consolidado aqui num arquivo só para referência futura.

-- ── Helper reaproveitado por push_objetivos_pendentes (cron semanal) e pelo
-- trigger de perfil_100_completo (evento) — mesma regra de "10 seções".
CREATE OR REPLACE FUNCTION public.profile_faltam_count(p public.profiles)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT
    (CASE WHEN NOT (p.tipo_atendimento IS NOT NULL AND p.situacao_juridica IS NOT NULL AND p.possui_clt IS NOT NULL AND p.possui_socios IS NOT NULL) THEN 1 ELSE 0 END) +
    (CASE WHEN NOT (p.atividade_exercida IS NOT NULL AND p.local_atuacao IS NOT NULL AND p.num_locais IS NOT NULL AND p.cidade_uf IS NOT NULL) THEN 1 ELSE 0 END) +
    (CASE WHEN NOT (p.faturamento_range IS NOT NULL AND p.notas_fiscais_range IS NOT NULL AND p.possui_funcionarios IS NOT NULL) THEN 1 ELSE 0 END) +
    (CASE WHEN p.como_conheceu IS NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p.foto_url IS NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p.bio IS NULL OR length(trim(p.bio)) = 0 THEN 1 ELSE 0 END) +
    (CASE WHEN p.instagram IS NULL AND p.linkedin IS NULL AND p.website IS NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p.subespecialidades IS NULL OR array_length(p.subespecialidades, 1) IS NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p.visita_solicitada_em IS NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p.plan = 'START' THEN 1 ELSE 0 END);
$$;

CREATE OR REPLACE FUNCTION public.push_objetivos_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare r record;
declare v_faltam int;
begin
  for r in select * from profiles where deleted_at is null and onboarding_complete = true
  loop
    v_faltam := profile_faltam_count(r);
    if v_faltam > 0 then
      perform call_send_push(
        r.id,
        'Complete seus objetivos 🏆',
        'Faltam ' || v_faltam || ' objetivos no seu perfil — cada um vale Olicoins.',
        jsonb_build_object('type', 'objetivos_pendentes')
      );
    end if;
  end loop;
end;
$function$;

-- ── 4.2 Ativação
CREATE OR REPLACE FUNCTION public.notify_perfil_100_completo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF profile_faltam_count(OLD) > 0 AND profile_faltam_count(NEW) = 0 THEN
    PERFORM call_send_push(
      NEW.id,
      'Perfil 100% completo! 🏆',
      'Você concluiu todos os objetivos de perfil. Confira seus Olicoins acumulados em Perfil.',
      jsonb_build_object('type', 'perfil_100_completo')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_perfil_100_completo ON public.profiles;
CREATE TRIGGER trg_notify_perfil_100_completo
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_perfil_100_completo();

CREATE OR REPLACE FUNCTION public.push_nudge_primeiro_paciente()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.onboarding_complete = true
      AND p.created_at::date = (now() - interval '5 days')::date
      AND NOT EXISTS (SELECT 1 FROM patients pt WHERE pt.professional_id = p.id)
  LOOP
    IF push_dispatch_allowed(r.id, 'nudge_primeiro_paciente', 'ativacao') THEN
      PERFORM call_send_push(r.id, 'Cadastre seu primeiro paciente 📋',
        'Fica tudo organizado em um só lugar, visível só para você. Vale 10 Olicoins.',
        jsonb_build_object('type', 'nudge_primeiro_paciente'));
      PERFORM log_push_dispatch(r.id, 'nudge_primeiro_paciente', 'ativacao');
    END IF;
  END LOOP;
END;
$$;

-- ── 4.3 Engajamento
CREATE OR REPLACE FUNCTION public.notify_conquista_desbloqueada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.evento LIKE 'ach_%' THEN
    PERFORM call_send_push(
      NEW.professional_id,
      'Nova conquista desbloqueada 🏅',
      'Você subiu de nível em uma das suas trilhas de conquista. Confira em Perfil → Seus objetivos.',
      jsonb_build_object('type', 'conquista_desbloqueada')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_conquista_desbloqueada ON public.olicoins_ledger;
CREATE TRIGGER trg_notify_conquista_desbloqueada
AFTER INSERT ON public.olicoins_ledger
FOR EACH ROW EXECUTE FUNCTION public.notify_conquista_desbloqueada();

CREATE OR REPLACE FUNCTION public.push_nudge_comunidade()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.onboarding_complete = true
      AND p.created_at <= now() - interval '10 days'
      AND NOT EXISTS (SELECT 1 FROM community_posts cp WHERE cp.professional_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM community_post_likes cl WHERE cl.professional_id = p.id)
  LOOP
    IF push_dispatch_allowed(r.id, 'nudge_comunidade', 'engajamento') THEN
      PERFORM call_send_push(r.id, 'Seus colegas estão na Comunidade 💬',
        'Veja o que outros profissionais do OLI andam postando, ou conte como está sua semana.',
        jsonb_build_object('type', 'nudge_comunidade'));
      PERFORM log_push_dispatch(r.id, 'nudge_comunidade', 'engajamento');
    END IF;
  END LOOP;
END;
$$;

-- Resumo diário agrupado de curtidas/comentários recebidos (decisão: evita
-- enxurrada de push por evento individual num post popular).
CREATE OR REPLACE FUNCTION public.push_resumo_comunidade_diario()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
DECLARE v_likes int;
DECLARE v_comments int;
DECLARE v_body text;
BEGIN
  FOR r IN
    SELECT DISTINCT cp.professional_id AS id
    FROM community_posts cp
    WHERE EXISTS (
      SELECT 1 FROM community_post_likes cl WHERE cl.post_id = cp.id AND cl.created_at >= now() - interval '24 hours'
    ) OR EXISTS (
      SELECT 1 FROM community_post_comments cc WHERE cc.post_id = cp.id AND cc.created_at >= now() - interval '24 hours'
    )
  LOOP
    SELECT count(*) INTO v_likes
    FROM community_post_likes cl JOIN community_posts cp ON cp.id = cl.post_id
    WHERE cp.professional_id = r.id AND cl.created_at >= now() - interval '24 hours';

    SELECT count(*) INTO v_comments
    FROM community_post_comments cc JOIN community_posts cp ON cp.id = cc.post_id
    WHERE cp.professional_id = r.id AND cc.created_at >= now() - interval '24 hours';

    v_body := '';
    IF v_likes > 0 THEN
      v_body := v_likes || (CASE WHEN v_likes = 1 THEN ' curtida nova' ELSE ' curtidas novas' END);
    END IF;
    IF v_comments > 0 THEN
      IF v_body <> '' THEN v_body := v_body || ' e '; END IF;
      v_body := v_body || v_comments || (CASE WHEN v_comments = 1 THEN ' comentário novo' ELSE ' comentários novos' END);
    END IF;
    v_body := v_body || ' no seu post. Toque para ver na Comunidade.';

    PERFORM call_send_push(r.id, 'Atividade no seu post 💬', v_body,
      jsonb_build_object('type', 'resumo_comunidade'));
  END LOOP;
END;
$$;

-- ── 4.4 Operacional
CREATE OR REPLACE FUNCTION public.notify_saldo_baixo_horas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prof         uuid;
  v_total_after  int;
  v_total_before int;
  v_delta_usados int := 0;
  v_delta_total  int := 0;
BEGIN
  v_prof := COALESCE(NEW.professional_id, OLD.professional_id);

  SELECT COALESCE(SUM(minutos_total - minutos_usados), 0) INTO v_total_after
  FROM hour_balance
  WHERE professional_id = v_prof AND expira_em > now();

  IF TG_OP = 'UPDATE' THEN
    v_delta_usados := NEW.minutos_usados - OLD.minutos_usados;
    v_delta_total  := NEW.minutos_total  - OLD.minutos_total;
  ELSIF TG_OP = 'INSERT' THEN
    v_delta_total := NEW.minutos_total;
  END IF;

  -- Total antes desta linha específica ter mudado (edge detection — dispara
  -- só na transição, nunca a cada tick de uso).
  v_total_before := v_total_after + v_delta_usados - v_delta_total;

  IF v_total_before >= 120 AND v_total_after < 120 THEN
    PERFORM call_send_push(
      v_prof,
      'Suas horas estão acabando ⏳',
      'Restam ' || floor(GREATEST(v_total_after, 0) / 60.0)::text || 'h' ||
        (CASE WHEN GREATEST(v_total_after, 0) % 60 > 0 THEN ' ' || (GREATEST(v_total_after, 0) % 60)::text || 'min' ELSE '' END) ||
        ' no seu saldo. Compre mais horas para não perder reserva.',
      jsonb_build_object('type', 'saldo_baixo_horas')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_saldo_baixo_horas ON public.hour_balance;
CREATE TRIGGER trg_notify_saldo_baixo_horas
AFTER INSERT OR UPDATE ON public.hour_balance
FOR EACH ROW EXECUTE FUNCTION public.notify_saldo_baixo_horas();

-- ── 4.5 Monetização
CREATE OR REPLACE FUNCTION public.push_sugestao_upgrade_plano()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
DECLARE v_horas numeric;
BEGIN
  FOR r IN
    SELECT p.id FROM profiles p
    WHERE p.deleted_at IS NULL AND p.plan = 'START' AND p.onboarding_complete = true
  LOOP
    SELECT COALESCE(SUM(minutos), 0) / 60.0 INTO v_horas
    FROM usage_charges
    WHERE professional_id = r.id
      AND date_trunc('month', iniciado_em) = date_trunc('month', now());

    IF v_horas >= 10 AND push_dispatch_allowed(r.id, 'sugestao_upgrade_plano', 'monetizacao') THEN
      PERFORM call_send_push(r.id, 'Seu uso já compensa o plano BASE 💡',
        'Você já usou ' || floor(v_horas)::text || 'h de sala este mês. Com o plano BASE sua hora fica mais barata. Dê uma olhada em Ecossistema.',
        jsonb_build_object('type', 'sugestao_upgrade_plano'));
      PERFORM log_push_dispatch(r.id, 'sugestao_upgrade_plano', 'monetizacao');
    END IF;
  END LOOP;
END;
$$;

-- Prioriza Contabilidade Médica — único módulo compatível com plano BASE
-- (os demais exigem PRO, empurrariam upgrade de plano só pra poder contratar).
CREATE OR REPLACE FUNCTION public.push_sugestao_modulo()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.onboarding_complete = true
      AND p.created_at <= now() - interval '14 days'
      AND profile_faltam_count(p) = 0
      AND NOT EXISTS (
        SELECT 1 FROM user_modules um
        WHERE um.professional_id = p.id AND um.status = 'active'
      )
  LOOP
    IF push_dispatch_allowed(r.id, 'sugestao_modulo', 'monetizacao') THEN
      PERFORM call_send_push(r.id, 'Conheça a Contabilidade Médica 📋',
        'Diagnóstico gratuito e gestão contábil pensada para profissionais de saúde. Veja em Ecossistema → Módulos.',
        jsonb_build_object('type', 'sugestao_modulo'));
      PERFORM log_push_dispatch(r.id, 'sugestao_modulo', 'monetizacao');
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.push_sugestao_anual()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT s.professional_id AS id
    FROM subscriptions s
    WHERE s.status = 'active' AND s.ciclo = 'mensal' AND s.starts_at <= now() - interval '3 months'
  LOOP
    IF push_dispatch_allowed(r.id, 'sugestao_anual', 'monetizacao') THEN
      PERFORM call_send_push(r.id, 'Plano anual rende desconto e Olicoins 🪙',
        'Mude para o ciclo anual em Ecossistema e garanta 25 Olicoins na hora.',
        jsonb_build_object('type', 'sugestao_anual'));
      PERFORM log_push_dispatch(r.id, 'sugestao_anual', 'monetizacao');
    END IF;
  END LOOP;
END;
$$;

-- ── 4.6 Indicação
CREATE OR REPLACE FUNCTION public.apply_referral_benefit(p_referrer_id uuid, p_new_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_already       BOOLEAN;
  v_code          TEXT;
  v_referrer_type TEXT;
  v_credit_target uuid;
  v_new_nome      TEXT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM referrals
    WHERE indicador_id = p_referrer_id
      AND indicado_id  = p_new_user_id
      AND beneficio_aplicado = true
  ) INTO v_already;
  IF v_already THEN RETURN; END IF;

  SELECT COALESCE(referral_code, 'MANUAL'), user_type
  INTO v_code, v_referrer_type
  FROM profiles WHERE id = p_referrer_id;

  IF v_referrer_type = 'partner' THEN
    v_credit_target := p_new_user_id;
  ELSE
    v_credit_target := p_referrer_id;
  END IF;

  INSERT INTO hour_balance (professional_id, minutos_total, minutos_usados, expira_em)
  VALUES (v_credit_target, 60, 0, NOW() + INTERVAL '90 days');

  UPDATE referrals
  SET beneficio_aplicado = true, status = 'rewarded', codigo = v_code
  WHERE indicador_id = p_referrer_id AND indicado_id = p_new_user_id;

  IF NOT FOUND THEN
    INSERT INTO referrals (codigo, indicador_id, indicado_id, status, beneficio_aplicado)
    VALUES (v_code, p_referrer_id, p_new_user_id, 'rewarded', true);
  END IF;

  -- Push de indicação confirmada — pra quem efetivamente ganhou os minutos.
  IF v_referrer_type = 'partner' THEN
    PERFORM call_send_push(
      v_credit_target,
      'Cadastro com indicação confirmado! 🎉',
      'Você ganhou 60 minutos de sala no OLI.',
      jsonb_build_object('type', 'indicacao_confirmada')
    );
  ELSE
    SELECT nome INTO v_new_nome FROM profiles WHERE id = p_new_user_id;
    PERFORM call_send_push(
      v_credit_target,
      'Indicação confirmada! 🎉',
      COALESCE(v_new_nome, 'Um colega') || ' se cadastrou com seu código — você ganhou 60 minutos de sala.',
      jsonb_build_object('type', 'indicacao_confirmada')
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.push_nudge_indicacao()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.onboarding_complete = true
      AND p.created_at <= now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM referrals rf WHERE rf.indicador_id = p.id)
  LOOP
    IF push_dispatch_allowed(r.id, 'nudge_indicacao', 'indicacao') THEN
      PERFORM call_send_push(r.id, 'Indique um colega e ganhe horas de sala 🎁',
        'Cada indicação que se cadastra rende 60 minutos de sala para você. Compartilhe seu link na aba Indicação.',
        jsonb_build_object('type', 'nudge_indicacao'));
      PERFORM log_push_dispatch(r.id, 'nudge_indicacao', 'indicacao');
    END IF;
  END LOOP;
END;
$$;

-- ── 4.7 Reativação — estende a função existente com o bucket de 30 dias e
-- varia levemente a copy do 14º dia (pedido explícito do doc-fonte).
CREATE OR REPLACE FUNCTION public.push_reacao_inatividade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare r record;
begin
  for r in
    select p.id,
           (now()::date - u.last_sign_in_at::date) as dias_inativo
    from profiles p
    join auth.users u on u.id = p.id
    where p.deleted_at is null
      and u.last_sign_in_at::date in (
        (now() - interval '7 days')::date,
        (now() - interval '14 days')::date,
        (now() - interval '30 days')::date
      )
  loop
    if r.dias_inativo >= 30 then
      perform call_send_push(
        r.id,
        'Sentimos sua falta de verdade 💚',
        'Faz um mês que você não aparece. Se travou em alguma coisa, fale com a gente no WhatsApp: (11) 97223-3745.',
        jsonb_build_object('type', 'reacao_inatividade_30d')
      );
    elsif r.dias_inativo >= 14 then
      perform call_send_push(
        r.id,
        'Sentimos sua falta 👋',
        'Já faz duas semanas — você tem objetivos esperando e Olicoins para ganhar.',
        jsonb_build_object('type', 'reacao_inatividade')
      );
    else
      perform call_send_push(
        r.id,
        'Sentimos sua falta 👋',
        'Faz um tempo que você não abre o app — tem Olicoins esperando por você.',
        jsonb_build_object('type', 'reacao_inatividade')
      );
    end if;
  end loop;
end;
$function$;

-- ── 4.8 Marcos
CREATE OR REPLACE FUNCTION public.push_aniversario_cadastro()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
DECLARE v_anos int;
BEGIN
  FOR r IN
    SELECT p.id, p.created_at FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.onboarding_complete = true
      AND extract(month from p.created_at) = extract(month from now())
      AND extract(day from p.created_at) = extract(day from now())
      AND p.created_at <= now() - interval '1 year'
  LOOP
    v_anos := extract(year from age(now(), r.created_at));
    PERFORM call_send_push(r.id,
      v_anos || ' ano' || (CASE WHEN v_anos > 1 THEN 's' ELSE '' END) || ' com o OLI 🎂',
      'Obrigado por confiar na gente esse tempo todo.',
      jsonb_build_object('type', 'aniversario_cadastro'));
  END LOOP;
END;
$$;

-- ── Agendamento dos crons novos (horários dentro da janela 9h–19h BRT)
select cron.schedule('push-nudge-primeiro-paciente', '0 12 * * *', $$select push_nudge_primeiro_paciente()$$);
select cron.schedule('push-nudge-comunidade', '0 12 * * 4', $$select push_nudge_comunidade()$$);
select cron.schedule('push-resumo-comunidade-diario', '0 21 * * *', $$select push_resumo_comunidade_diario()$$);
select cron.schedule('push-sugestao-upgrade-plano', '0 12 1 * *', $$select push_sugestao_upgrade_plano()$$);
select cron.schedule('push-sugestao-modulo', '0 13 1 * *', $$select push_sugestao_modulo()$$);
select cron.schedule('push-sugestao-anual', '0 14 1 * *', $$select push_sugestao_anual()$$);
select cron.schedule('push-nudge-indicacao', '0 15 1 * *', $$select push_nudge_indicacao()$$);
select cron.schedule('push-aniversario-cadastro', '0 12 * * *', $$select push_aniversario_cadastro()$$);
