import { supabase } from './supabase';

// Ledger de eventos que rendem Olicoins. Append-only — evento é único por
// profissional, então creditar 2x o mesmo evento é seguro (ignora conflito).
export async function creditOlicoins(professionalId: string, evento: string, pontos: number): Promise<void> {
  await supabase
    .from('olicoins_ledger')
    .insert({ professional_id: professionalId, evento, pontos })
    .select()
    .maybeSingle(); // erro de unique constraint (evento já creditado) é ignorado silenciosamente
}

export async function fetchTotalOlicoins(professionalId: string): Promise<number> {
  const { data } = await supabase
    .from('olicoins_ledger')
    .select('pontos')
    .eq('professional_id', professionalId);
  return (data ?? []).reduce((sum, row) => sum + row.pontos, 0);
}

// ─── Objetivos de ação — além de preencher o perfil ──────────────────────────
// Progresso do app não é só sobre cadastro: usar a sala, cadastrar paciente,
// postar na comunidade, indicar colega e ativar módulo também valem Olicoins.
// Cada objetivo é reconciliado a partir do estado real (não precisa instrumentar
// toda tela que faz a ação) — ao abrir o Início, checa se já foi feito e credita.

export interface ActionObjective {
  id:        string;
  evento:    string;
  pontos:    number;
  titulo:    string;
  descricao: string;
  check:     (professionalId: string) => Promise<boolean>;
}

async function hasReserva(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('reservations').select('id').eq('professional_id', professionalId).limit(1);
  return !!data && data.length > 0;
}

async function hasPaciente(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('patients').select('id').eq('professional_id', professionalId).limit(1);
  return !!data && data.length > 0;
}

async function hasPost(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('community_posts').select('id').eq('professional_id', professionalId).limit(1);
  return !!data && data.length > 0;
}

async function hasIndicacaoEnviada(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('id').eq('referido_por', professionalId).limit(1);
  return !!data && data.length > 0;
}

async function hasModuloAtivo(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('user_modules').select('id').eq('professional_id', professionalId).eq('status', 'active').limit(1);
  return !!data && data.length > 0;
}

async function hasAtendimentoRealizado(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('reservations').select('id').eq('professional_id', professionalId).not('arrived_at', 'is', null).limit(1);
  return !!data && data.length > 0;
}

async function hasPacoteHoras(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('hour_balance').select('id').eq('professional_id', professionalId).limit(1);
  return !!data && data.length > 0;
}

async function hasLike(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('community_post_likes').select('id').eq('professional_id', professionalId).limit(1);
  return !!data && data.length > 0;
}

async function hasComentario(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('community_post_comments').select('id').eq('professional_id', professionalId).limit(1);
  return !!data && data.length > 0;
}

async function hasMfaAtivo(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp?.length ?? 0) > 0;
}

async function hasPlanoAnual(professionalId: string): Promise<boolean> {
  const { data } = await supabase.from('subscriptions').select('id').eq('professional_id', professionalId).eq('ciclo', 'YEARLY').limit(1);
  return !!data && data.length > 0;
}

export const ACTION_OBJECTIVES: ActionObjective[] = [
  {
    id: 'primeira_reserva', evento: 'primeira_reserva', pontos: 10,
    titulo: 'Fazer sua primeira reserva de sala',
    descricao: 'Vá na aba Salas, escolha um horário livre e reserve.',
    check: hasReserva,
  },
  {
    id: 'primeiro_paciente', evento: 'primeiro_paciente', pontos: 10,
    titulo: 'Cadastrar seu primeiro paciente',
    descricao: 'Vá na aba Pacientes e toque em Adicionar Paciente.',
    check: hasPaciente,
  },
  {
    id: 'primeiro_post', evento: 'primeiro_post', pontos: 10,
    titulo: 'Publicar na Comunidade',
    descricao: 'Vá na aba Comunidade, aba Feed, e escreva um post.',
    check: hasPost,
  },
  {
    id: 'indicacao_enviada', evento: 'indicacao_enviada', pontos: 10,
    titulo: 'Indicar um colega que se cadastrou',
    descricao: 'Vá em Indicação, compartilhe seu link e aguarde o colega se cadastrar.',
    check: hasIndicacaoEnviada,
  },
  {
    id: 'modulo_ativo', evento: 'modulo_ativo', pontos: 10,
    titulo: 'Ativar um módulo do ecossistema',
    descricao: 'Vá na aba Ecossistema e ative um módulo (Communicare, Contábil...).',
    check: hasModuloAtivo,
  },
  {
    id: 'primeiro_atendimento', evento: 'primeiro_atendimento', pontos: 15,
    titulo: 'Realizar seu primeiro atendimento',
    descricao: 'Faça check-in numa reserva de sala (QR Code ou manual) e atenda um paciente.',
    check: hasAtendimentoRealizado,
  },
  {
    id: 'primeiro_pacote_horas', evento: 'primeiro_pacote_horas', pontos: 15,
    titulo: 'Comprar um pacote de horas',
    descricao: 'Vá na aba Financeiro e compre um pacote de horas.',
    check: hasPacoteHoras,
  },
  {
    id: 'primeiro_like', evento: 'primeiro_like', pontos: 5,
    titulo: 'Curtir um post na Comunidade',
    descricao: 'Vá na aba Comunidade, aba Feed, e curta um post.',
    check: hasLike,
  },
  {
    id: 'primeiro_comentario', evento: 'primeiro_comentario', pontos: 5,
    titulo: 'Comentar em um post',
    descricao: 'Vá na aba Comunidade, aba Feed, e comente em um post.',
    check: hasComentario,
  },
  {
    id: 'mfa_ativado', evento: 'mfa_ativado', pontos: 15,
    titulo: 'Ativar verificação em duas etapas',
    descricao: 'Vá em Perfil → Segurança e configure a verificação em duas etapas.',
    check: hasMfaAtivo,
  },
  {
    id: 'plano_anual', evento: 'plano_anual', pontos: 25,
    titulo: 'Fechar plano anual',
    descricao: 'Vá em Ecossistema e assine o plano BASE ou PRO no ciclo anual.',
    check: hasPlanoAnual,
  },
];

export async function reconcileActionObjectives(professionalId: string): Promise<{
  newlyEarned:  ActionObjective[];
  completedIds: string[];
}> {
  const { data: ledgerRows } = await supabase
    .from('olicoins_ledger')
    .select('evento')
    .eq('professional_id', professionalId);
  const creditedEventos = new Set((ledgerRows ?? []).map(r => r.evento));

  const newlyEarned:  ActionObjective[] = [];
  const completedIds: string[] = [];

  for (const objetivo of ACTION_OBJECTIVES) {
    if (creditedEventos.has(objetivo.evento)) { completedIds.push(objetivo.id); continue; }
    const done = await objetivo.check(professionalId);
    if (done) {
      await creditOlicoins(professionalId, objetivo.evento, objetivo.pontos);
      newlyEarned.push(objetivo);
      completedIds.push(objetivo.id);
    }
  }
  return { newlyEarned, completedIds };
}
