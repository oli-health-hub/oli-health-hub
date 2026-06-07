import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { Profile } from '../services/auth';
import { ensureCommunicareSSO } from '../services/communicareSSO';

interface AuthStore {
  session:     Session | null;
  user:        User | null;
  profile:     Profile | null;
  isLoading:   boolean;
  setSession:  (session: Session | null) => void;
  setProfile:  (profile: Profile | null) => void;
  setLoading:  (v: boolean) => void;
  initialize:  () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session:   null,
  user:      null,
  profile:   null,
  isLoading: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    set({ isLoading: true });
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null });

    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      set({ profile });
      // SSO Communicare paralelo silencioso (não bloqueia UI)
      const cpfFromProfile = (profile as unknown as { cpf?: string })?.cpf;
      if (cpfFromProfile) void ensureCommunicareSSO(profile!.id, cpfFromProfile);
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        set({ profile });
        const cpfFromProfile = (profile as unknown as { cpf?: string })?.cpf;
      if (cpfFromProfile) void ensureCommunicareSSO(profile!.id, cpfFromProfile);
      } else {
        set({ profile: null });
      }
    });

    set({ isLoading: false });
  },
}));
