/**
 * npsService.ts
 *
 * NPS nativo OLI — envia link de pesquisa por WhatsApp e calcula score.
 * Fase 3: merge com dados Communicare via campo `context`.
 */

import { Linking } from 'react-native';
import { supabase } from './supabase';
import type { Patient } from '../models/types';

const EDGE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/nps`;

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface NPSStats {
  /** Média das notas respondidas (null = sem respostas ainda) */
  avg:          number | null;
  /** Total de respostas recebidas */
  count:        number;
  /** Score NPS = % promotores (9-10) − % detratores (0-6) */
  nps:          number | null;
  /** Pesquisas enviadas aguardando resposta */
  pendingCount: number;
}

// ─── Enviar NPS ───────────────────────────────────────────────────────────────

/**
 * Cria registro pendente em `nps_responses` e abre WhatsApp com link de avaliação.
 * Não lança exceção se WhatsApp não estiver disponível — falha silenciosamente.
 */
export async function sendNPS(patient: Patient, professionalId: string): Promise<void> {
  const { data, error } = await supabase
    .from('nps_responses')
    .insert({
      professional_id: professionalId,
      patient_phone:   patient.telefone,
      patient_name:    patient.nome,
      context:         'app_checkout',
    })
    .select('nps_token')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Erro ao criar NPS');

  const link = `${EDGE_URL}?token=${data.nps_token}`;
  const msg  = encodeURIComponent(
    `Olá, ${patient.nome.split(' ')[0]}! 👋\n\n` +
    `Em quanto você avalia o atendimento que recebeu? Sua opinião é muito importante.\n\n` +
    `👉 ${link}\n\n` +
    `(Leva menos de 30 segundos — clique em um número de 0 a 10)`,
  );

  const phone = patient.telefone.replace(/\D/g, '');
  const waUrl = `https://wa.me/55${phone}?text=${msg}`;

  const supported = await Linking.canOpenURL(waUrl).catch(() => false);
  if (supported) {
    await Linking.openURL(waUrl).catch(() => {});
  }
}

// ─── Buscar estatísticas ──────────────────────────────────────────────────────

export async function getNPSStats(professionalId: string): Promise<NPSStats> {
  // Respondidas
  const { data: answered } = await supabase
    .from('nps_responses')
    .select('score')
    .eq('professional_id', professionalId)
    .not('answered_at', 'is', null)
    .not('score', 'is', null);

  // Pendentes
  const { count: pendingCount } = await supabase
    .from('nps_responses')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', professionalId)
    .is('answered_at', null);

  if (!answered || answered.length === 0) {
    return { avg: null, count: 0, nps: null, pendingCount: pendingCount ?? 0 };
  }

  const scores    = answered.map(r => r.score as number);
  const avg       = scores.reduce((a, b) => a + b, 0) / scores.length;
  const promoters = scores.filter(s => s >= 9).length;
  const detractors= scores.filter(s => s <= 6).length;
  const nps       = Math.round(((promoters - detractors) / scores.length) * 100);

  return {
    avg:          Math.round(avg * 10) / 10,
    count:        scores.length,
    nps,
    pendingCount: pendingCount ?? 0,
  };
}
