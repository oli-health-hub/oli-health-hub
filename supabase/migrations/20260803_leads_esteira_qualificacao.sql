-- ============================================================================
-- Esteira de leads ampliada + campos de qualificação
-- Aplicada em produção via Supabase MCP em 03/ago/2026.
-- Ver docs/HANDOFF.md §22.
-- ============================================================================

-- A esteira antiga pulava de "visita agendada" direto para "convertido":
-- quem visitou e ficou pensando, e quem nunca atendeu o telefone, ficavam
-- invisíveis. A ordem do array é a ordem da esteira.
alter table public.leads drop constraint leads_status_valido;
alter table public.leads add constraint leads_status_valido check (
  status = any (array[
    'novo',
    'contatado',
    'sem_resposta',        -- tentou e não conseguiu falar
    'aguardando_retorno',  -- falou e a pessoa ficou de responder
    'visita_agendada',
    'visita_realizada',    -- visitou, ainda não decidiu
    'proposta_enviada',
    'convertido',
    'descartado'
  ])
);

-- Qualificação: independe da etapa. Um lead pode estar "aguardando retorno"
-- e ser "quente" ao mesmo tempo. Nulo = ainda não avaliado.
alter table public.leads
  add column temperatura     text,
  add column perfil          text,
  add column motivo_descarte text;

alter table public.leads
  add constraint leads_temperatura_valida
    check (temperatura is null or temperatura = any (array['quente','morno','frio'])),
  add constraint leads_perfil_valido
    check (perfil is null or perfil = any (array['dentro','fora','a_confirmar'])),
  -- Lista fechada de propósito: com texto livre não dá para somar depois
  -- qual motivo mais derruba lead.
  add constraint leads_motivo_descarte_valido
    check (motivo_descarte is null or motivo_descarte = any (array[
      'mora_longe','achou_caro','sem_perfil','contato_invalido','sumiu','sem_interesse'
    ]));

-- Motivo só faz sentido em lead descartado. Sem isto sobra motivo órfão de
-- quando alguém descarta e depois reativa o lead.
--
-- ⚠️ O select de motivo na tela /leads fica sempre visível (esconder
-- condicionalmente exigiria virar client component só por isso), então
-- `updateLead` em admin/app/actions.ts limpa o campo quando a etapa não é
-- 'descartado'. Mexer numa ponta sem a outra faz reativar lead estourar
-- erro de constraint na cara do usuário.
alter table public.leads
  add constraint leads_motivo_so_em_descartado
    check (motivo_descarte is null or status = 'descartado');

comment on column public.leads.temperatura     is 'Quanto o lead promete, na avaliação de quem atendeu: quente | morno | frio. Independe do status.';
comment on column public.leads.perfil          is 'Se a pessoa serve para o OLI: dentro | fora | a_confirmar. Usado principalmente para lead de outra cidade.';
comment on column public.leads.motivo_descarte is 'Só preenchido quando status = descartado. Serve para somar o que mais derruba lead.';
