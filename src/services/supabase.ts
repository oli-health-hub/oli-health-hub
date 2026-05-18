import { createClient } from '@supabase/supabase-js';
import type { Database } from '../models/database.types';

const SUPABASE_URL  = 'https://xwcarrurjvfxisuaihid.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3Y2FycnVyanZmeGlzdWFpaGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTYzMDYsImV4cCI6MjA5NDA5MjMwNn0.HcHGXJHe07doNXwpH8Og4v84eQ63DGU5odaI7Ry3d6M';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON);
