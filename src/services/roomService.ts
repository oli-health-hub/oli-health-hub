import { supabase } from './supabase';
import type { Room } from '../models/types';

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('id');
  if (error) throw error;
  return data.map(r => ({
    id:          r.id,
    name:        r.name,
    specialties: r.specialties,
    items:       r.items,
    note:        r.note ?? undefined,
    isAvailable: r.is_available,
    occupiedBy:  r.occupied_by ?? undefined,
  }));
}

export async function setRoomAvailability(name: string, isAvailable: boolean, occupiedBy?: string) {
  const { error } = await supabase
    .from('rooms')
    .update({ is_available: isAvailable, occupied_by: occupiedBy ?? null })
    .eq('name', name);
  if (error) throw error;
}
