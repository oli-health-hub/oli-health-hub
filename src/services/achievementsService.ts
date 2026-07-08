import { supabase } from './supabase';
import { creditOlicoins } from './olicoinsService';

// Conquistas por quantidade — diferente dos objetivos (que são 1x cada), aqui
// cada trilha tem vários tiers (Bronze/Prata/Ouro/Platina). Reaproveita o mesmo
// ledger de eventos (cada tier = 1 evento único), sem schema novo.

export interface AchievementTier {
  threshold: number;
  pontos:    number;
  label:     string;
  evento:    string;
}

export interface AchievementTrack {
  id:      string;
  titulo:  string;
  unidade: string;
  metric:  (professionalId: string) => Promise<number>;
  tiers:   AchievementTier[];
}

async function countReservas(professionalId: string): Promise<number> {
  const { count } = await supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('professional_id', professionalId);
  return count ?? 0;
}

async function countPacientes(professionalId: string): Promise<number> {
  const { count } = await supabase.from('patients').select('id', { count: 'exact', head: true }).eq('professional_id', professionalId);
  return count ?? 0;
}

async function countEngajamentoComunidade(professionalId: string): Promise<number> {
  const [posts, likes, comments] = await Promise.all([
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('professional_id', professionalId),
    supabase.from('community_post_likes').select('id', { count: 'exact', head: true }).eq('professional_id', professionalId),
    supabase.from('community_post_comments').select('id', { count: 'exact', head: true }).eq('professional_id', professionalId),
  ]);
  return (posts.count ?? 0) + (likes.count ?? 0) + (comments.count ?? 0);
}

async function sumHorasSala(professionalId: string): Promise<number> {
  const { data } = await supabase.from('usage_charges').select('minutos').eq('professional_id', professionalId);
  const minutos = (data ?? []).reduce((sum, r) => sum + r.minutos, 0);
  return Math.floor(minutos / 60);
}

async function countPacotesComprados(professionalId: string): Promise<number> {
  const { count } = await supabase.from('hour_balance').select('id', { count: 'exact', head: true }).eq('professional_id', professionalId);
  return count ?? 0;
}

export const ACHIEVEMENT_TRACKS: AchievementTrack[] = [
  {
    id: 'reservas', titulo: 'Reservas de sala', unidade: 'reservas', metric: countReservas,
    tiers: [
      { threshold: 5,   pontos: 10, label: 'Bronze',  evento: 'ach_reservas_5' },
      { threshold: 20,  pontos: 20, label: 'Prata',   evento: 'ach_reservas_20' },
      { threshold: 50,  pontos: 40, label: 'Ouro',    evento: 'ach_reservas_50' },
      { threshold: 100, pontos: 80, label: 'Platina', evento: 'ach_reservas_100' },
    ],
  },
  {
    id: 'pacientes', titulo: 'Pacientes cadastrados', unidade: 'pacientes', metric: countPacientes,
    tiers: [
      { threshold: 5,  pontos: 10, label: 'Bronze', evento: 'ach_pacientes_5' },
      { threshold: 20, pontos: 20, label: 'Prata',  evento: 'ach_pacientes_20' },
      { threshold: 50, pontos: 40, label: 'Ouro',   evento: 'ach_pacientes_50' },
    ],
  },
  {
    id: 'comunidade', titulo: 'Engajamento na Comunidade', unidade: 'ações', metric: countEngajamentoComunidade,
    tiers: [
      { threshold: 10, pontos: 15, label: 'Bronze', evento: 'ach_comunidade_10' },
      { threshold: 50, pontos: 30, label: 'Prata',  evento: 'ach_comunidade_50' },
    ],
  },
  {
    id: 'horas_sala', titulo: 'Horas de sala usadas', unidade: 'horas', metric: sumHorasSala,
    tiers: [
      { threshold: 10,  pontos: 15, label: 'Bronze',  evento: 'ach_horas_10' },
      { threshold: 50,  pontos: 30, label: 'Prata',   evento: 'ach_horas_50' },
      { threshold: 100, pontos: 60, label: 'Ouro',    evento: 'ach_horas_100' },
    ],
  },
  {
    id: 'pacotes_horas', titulo: 'Pacotes de horas comprados', unidade: 'pacotes', metric: countPacotesComprados,
    tiers: [
      { threshold: 1,  pontos: 10, label: 'Bronze',  evento: 'ach_pacotes_1' },
      { threshold: 3,  pontos: 20, label: 'Prata',   evento: 'ach_pacotes_3' },
      { threshold: 5,  pontos: 40, label: 'Ouro',    evento: 'ach_pacotes_5' },
      { threshold: 10, pontos: 80, label: 'Platina', evento: 'ach_pacotes_10' },
    ],
  },
];

export async function reconcileAchievements(professionalId: string): Promise<{
  newlyEarned: { track: AchievementTrack; tier: AchievementTier }[];
}> {
  const { data: ledgerRows } = await supabase
    .from('olicoins_ledger')
    .select('evento')
    .eq('professional_id', professionalId);
  const creditedEventos = new Set((ledgerRows ?? []).map(r => r.evento));

  const newlyEarned: { track: AchievementTrack; tier: AchievementTier }[] = [];

  for (const track of ACHIEVEMENT_TRACKS) {
    const pendingTiers = track.tiers.filter(t => !creditedEventos.has(t.evento));
    if (pendingTiers.length === 0) continue;
    const value = await track.metric(professionalId);
    for (const tier of pendingTiers) {
      if (value >= tier.threshold) {
        await creditOlicoins(professionalId, tier.evento, tier.pontos);
        newlyEarned.push({ track, tier });
      }
    }
  }
  return { newlyEarned };
}
