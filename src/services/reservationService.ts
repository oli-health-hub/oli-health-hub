import { supabase } from './supabase';
import type { Reservation, ReservationStatus } from '../models/types';

function toReservation(r: {
  id: string; room_name: string; start_time: string; end_time: string;
  status: string; arrived_at: string | null; consultation_started_at: string | null;
  consultation_ended_at: string | null;
}): Reservation {
  return {
    id:                     r.id,
    roomName:               r.room_name,
    startTime:              r.start_time,
    endTime:                r.end_time,
    status:                 r.status as ReservationStatus,
    arrivedAt:              r.arrived_at ?? undefined,
    consultationStartedAt:  r.consultation_started_at ?? undefined,
    consultationEndedAt:    r.consultation_ended_at ?? undefined,
  };
}

/** Reservas do profissional de hoje até `daysAhead` dias no futuro (cobre agenda, encaixe e reagendamento). */
export async function fetchUpcomingReservations(professionalId: string, daysAhead = 180): Promise<Reservation[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('professional_id', professionalId)
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time');
  if (error) throw error;
  return data.map(toReservation);
}

/**
 * Ocupação de TODAS as salas por TODOS os profissionais (hoje até `daysAhead` dias no futuro).
 * Usada só pra checagem de conflito de horário/sala — reservas de outros profissionais não
 * apareciam aqui antes, então dois médicos podiam reservar a mesma sala no mesmo horário sem aviso.
 * RLS de `reservations` só libera as próprias linhas, então isso passa pela RPC
 * `get_room_occupancy` (SECURITY DEFINER) — expõe só sala/horário/status, sem identificar
 * o outro profissional.
 */
export async function fetchRoomOccupancy(daysAhead = 180): Promise<Reservation[]> {
  const { data, error } = await supabase.rpc('get_room_occupancy', { days_ahead: daysAhead });
  if (error) throw error;
  return (data ?? []).map(r => ({
    id:        r.id,
    roomName:  r.room_name,
    startTime: r.start_time,
    endTime:   r.end_time,
    status:    r.status as ReservationStatus,
  }));
}

export async function createReservation(reservation: Reservation, professionalId: string): Promise<void> {
  const { error } = await supabase.from('reservations').insert({
    id:             reservation.id,
    professional_id: professionalId,
    room_name:      reservation.roomName,
    start_time:     reservation.startTime,
    end_time:       reservation.endTime,
    status:         reservation.status ?? 'agendado',
  });
  if (error) throw error;
}

export async function deleteReservation(id: string): Promise<void> {
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) throw error;
}

export async function updateReservation(id: string, updates: {
  start_time?: string;
  end_time?: string;
  room_name?: string;
  status?: string;
  arrived_at?: string;
  consultation_started_at?: string;
  consultation_ended_at?: string;
}): Promise<void> {
  const { error } = await supabase.from('reservations').update(updates).eq('id', id);
  if (error) throw error;
}
