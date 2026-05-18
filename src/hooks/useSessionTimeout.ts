/**
 * useSessionTimeout.ts
 *
 * Faz logout automático após 30 minutos de inatividade total do app.
 * Diferente do app lock (que apenas bloqueia a UI), este hook encerra
 * a sessão Supabase completamente — adequado para dados de saúde (LGPD).
 *
 * Ativado pelo _layout.tsx quando há sessão ativa.
 * Eventos que resetam o timer: toque, scroll, teclado.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { signOut } from '../services/auth';
import { useAuthStore } from '../store/authStore';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

export function useSessionTimeout() {
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundRef   = useRef<Date | null>(null);
  const { session }     = useAuthStore();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!session) return;
    clearTimer();
    timerRef.current = setTimeout(async () => {
      await signOut();
    }, TIMEOUT_MS);
  }, [session, clearTimer]);

  // Monitora AppState: se ficar em background por mais de 30 min, faz logout
  useEffect(() => {
    if (!session) return;

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundRef.current = new Date();
      } else if (nextState === 'active') {
        if (backgroundRef.current) {
          const elapsed = Date.now() - backgroundRef.current.getTime();
          backgroundRef.current = null;
          if (elapsed >= TIMEOUT_MS) {
            clearTimer();
            await signOut();
            return;
          }
        }
        resetTimer();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    resetTimer();

    return () => {
      sub.remove();
      clearTimer();
    };
  }, [session, resetTimer, clearTimer]);

  // Expõe resetTimer para ser chamado em interações do usuário
  return { resetTimer };
}
