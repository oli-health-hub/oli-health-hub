import { supabase } from './supabase';
import type { Database } from '../models/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
// Profile inclui: id, nome, crm, especialidade, plan, consultation_duration_minutes, bio, foto_url, created_at
// Onboarding: onboarding_complete, situacao_juridica, faturamento_range, atividade_exercida,
//   possui_clt, local_atuacao, num_locais, cidade_uf, notas_fiscais_range,
//   possui_funcionarios, previsao_contratacao, possui_socios

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Destino após o usuário confirmar o e-mail (página de sucesso + deep link).
const EMAIL_CONFIRM_REDIRECT =
  'https://xwcarrurjvfxisuaihid.supabase.co/functions/v1/auth-confirm';

export async function signUp(email: string, password: string, nome: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome },
      emailRedirectTo: EMAIL_CONFIRM_REDIRECT,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function updateProfile(userId: string, updates: Database['public']['Tables']['profiles']['Update']) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}
