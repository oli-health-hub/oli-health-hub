import type { Profile } from '../services/auth';

// Seções do perfil que saíram do onboarding e viram missões dentro do app,
// cada uma valendo Olicoins ao ser completada (evento único no ledger).
export interface ProfileSection {
  id:        string;
  evento:    string;
  pontos:    number;
  titulo:    string;
  descricao: string;
  isComplete: (p: Profile) => boolean;
}

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    id:        'atendimento_juridico',
    evento:    'secao_atendimento_juridico',
    pontos:    10,
    titulo:    'Atendimento e estrutura jurídica',
    descricao: 'Vá em Perfil → Editar e preencha atendimento, situação jurídica, CLT e sócios.',
    isComplete: p => !!p.tipo_atendimento && !!p.situacao_juridica && p.possui_clt !== null && p.possui_socios !== null,
  },
  {
    id:        'atividade_local',
    evento:    'secao_atividade_local',
    pontos:    10,
    titulo:    'Atividade e locais de atuação',
    descricao: 'Vá em Perfil → Editar e preencha especialidade, local e cidade/estado de atuação.',
    isComplete: p => !!p.atividade_exercida && !!p.local_atuacao && !!p.num_locais && !!p.cidade_uf,
  },
  {
    id:        'financeiro',
    evento:    'secao_financeiro',
    pontos:    10,
    titulo:    'Financeiro e estrutura operacional',
    descricao: 'Vá em Perfil → Editar e preencha faturamento, notas fiscais e funcionários.',
    isComplete: p => !!p.faturamento_range && !!p.notas_fiscais_range && p.possui_funcionarios !== null,
  },
  {
    id:        'como_conheceu',
    evento:    'secao_como_conheceu',
    pontos:    5,
    titulo:    'Como você nos conheceu',
    descricao: 'Vá em Perfil → Editar e conte como chegou até o OLI.',
    isComplete: p => !!p.como_conheceu,
  },
  {
    id:        'foto_perfil',
    evento:    'secao_foto_perfil',
    pontos:    5,
    titulo:    'Adicionar foto de perfil',
    descricao: 'Vá em Perfil e toque na sua foto pra escolher uma.',
    isComplete: p => !!p.foto_url,
  },
  {
    id:        'bio_preenchida',
    evento:    'secao_bio',
    pontos:    5,
    titulo:    'Escrever uma bio',
    descricao: 'Vá em Perfil → Editar e escreva sobre você (aparece na Comunidade).',
    isComplete: p => !!p.bio && p.bio.trim().length > 0,
  },
  {
    id:        'redes_sociais',
    evento:    'secao_redes_sociais',
    pontos:    5,
    titulo:    'Conectar uma rede social',
    descricao: 'Vá em Perfil → Editar e adicione Instagram, LinkedIn ou site.',
    isComplete: p => !!p.instagram || !!p.linkedin || !!p.website,
  },
  {
    id:        'subespecialidades',
    evento:    'secao_subespecialidades',
    pontos:    5,
    titulo:    'Adicionar subespecialidades',
    descricao: 'Vá em Perfil → Editar e adicione suas subespecialidades.',
    isComplete: p => !!p.subespecialidades && p.subespecialidades.length > 0,
  },
  {
    id:        'visita_agendada',
    evento:    'secao_visita_agendada',
    pontos:    10,
    titulo:    'Agendar visita presencial',
    descricao: 'Toque no badge "Agendar visita" na tela Início.',
    isComplete: p => !!p.visita_solicitada_em,
  },
  {
    id:        'plano_pago',
    evento:    'secao_plano_pago',
    pontos:    20,
    titulo:    'Assinar um plano pago',
    descricao: 'Vá em Ecossistema e assine o plano BASE ou PRO.',
    isComplete: p => p.plan !== 'START',
  },
];

export function isProfileFullyComplete(p: Profile): boolean {
  return PROFILE_SECTIONS.every(s => s.isComplete(p));
}

export function countCompletedSections(p: Profile): number {
  return PROFILE_SECTIONS.filter(s => s.isComplete(p)).length;
}
