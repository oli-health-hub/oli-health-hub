import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../models/database.types';

export const SUPABASE_URL = 'https://xwcarrurjvfxisuaihid.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3Y2FycnVyanZmeGlzdWFpaGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTYzMDYsImV4cCI6MjA5NDA5MjMwNn0.HcHGXJHe07doNXwpH8Og4v84eQ63DGU5odaI7Ry3d6M';

/**
 * Cliente Supabase configurado para React Native.
 *
 * AsyncStorage é obrigatório para persistir a sessão entre reinicializações.
 * Sem isso, o usuário perde a sessão toda vez que o app é fechado.
 *
 * detectSessionInUrl: false — evita conflito com Expo Router deep links.
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
