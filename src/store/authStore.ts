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
  /** false enquanto o profile do usuário logado ainda não foi buscado.
   *  Evita decidir o gate de onboarding com profile=null (race no login). */
  profileLoaded: boolean;
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
  profileLoaded: false,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile, profileLoaded: true }),
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

    // IMPORTANTE: o callback NÃO pode ser async nem await chamadas supabase aqui.
    // Ele roda dentro do lock interno de auth; qualquer chamada supabase (ex.: .from()
    // que busca o token via getSession) tenta o mesmo lock → deadlock (updateUser/signOut
    // ficam pendurados pra sempre). Deferimos o fetch de profile pra fora do lock.
    supabase.auth.onAuthStateChange((_event, session) => {
      const hadUser = !!session?.user;
      // Marca profile como "carregando" para o usuário recém-logado — o gate de
      // onboarding aguarda profileLoaded antes de decidir (evita race com profile=null).
      set({ session, user: session?.user ?? null, profileLoaded: !hadUser });

      if (session?.user) {
        const userId = session.user.id;
        setTimeout(() => {
          void (async () => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
            set({ profile, profileLoaded: true });
            const cpfFromProfile = (profile as unknown as { cpf?: string })?.cpf;
            if (cpfFromProfile) void ensureCommunicareSSO(profile!.id, cpfFromProfile);
          })();
        }, 0);
      } else {
        set({ profile: null });
      }
    });

    set({ isLoading: false, profileLoaded: true });
  },
}));
