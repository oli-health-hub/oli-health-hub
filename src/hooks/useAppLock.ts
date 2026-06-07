import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../services/supabase';

// 0 = bloqueia imediatamente ao retornar do background (Face ID sempre).
// Mantido como const para fácil ajuste futuro caso queira tolerância.
const LOCK_AFTER_MS       = 0;
const SECURE_KEY_ENABLED  = 'oli_biometric_enabled';
const SECURE_KEY_BG_TIME  = 'oli_background_time';
// Se o desbloqueio foi via código do dispositivo (não biometria), a próxima
// sessão exige login com e-mail/senha — flag persistida e consumida no cold start.
const SECURE_KEY_FORCE_PWD = 'oli_force_password_next';

export interface AppLockState {
  isLocked:           boolean;
  biometricAvailable: boolean;
  biometricEnabled:   boolean;
  unlock:             (useDevicePasscode?: boolean) => Promise<boolean>;
  enableBiometric:    () => Promise<boolean>;
  disableBiometric:   () => Promise<void>;
}

export function useAppLock(): AppLockState {
  const [isLocked,           setIsLocked]           = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled,   setBiometricEnabled]   = useState(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Guard anti-prompt-duplicado: impede duas chamadas simultâneas de authenticateAsync.
  const authInFlightRef = useRef(false);
  // Após desbloqueio, ignora re-lock por um curto período. Em alguns devices o
  // prompt biométrico manda o app para 'background'; ao voltar 'active' o
  // listener re-bloqueava → AppLockScreen remontava → SEGUNDO popup.
  const suppressRelockUntilRef = useRef(0);

  // ── Verifica suporte a biometria + bloqueia imediatamente em cold start ──
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      const stored = await SecureStore.getItemAsync(SECURE_KEY_ENABLED);
      const enabled = stored === 'true';
      setBiometricEnabled(enabled);

      // Sessão anterior foi desbloqueada com CÓDIGO do dispositivo →
      // exige login completo (e-mail/senha) agora. Consome a flag e desloga.
      const forcePwd = await SecureStore.getItemAsync(SECURE_KEY_FORCE_PWD);
      if (forcePwd === 'true') {
        await SecureStore.deleteItemAsync(SECURE_KEY_FORCE_PWD);
        await supabase.auth.signOut().catch(() => {});
        return; // não bloqueia — _layout leva ao login
      }

      // COLD START: se biometria estiver habilitada, app abre BLOQUEADO
      // Usuário precisa autenticar antes de acessar conteúdo logado.
      if (enabled) setIsLocked(true);
    })();
  }, []);

  // ── Listener de AppState — bloqueia após 5 min em background ──
  // IMPORTANTE: a transição correta para "volta do background" é
  // background → active. O LocalAuthentication coloca o app em 'inactive'
  // durante o prompt biométrico; se considerássemos inactive→active como
  // "voltou do background" o app re-bloqueava em loop logo após desbloquear.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev === 'active' && nextState === 'background') {
        await SecureStore.setItemAsync(SECURE_KEY_BG_TIME, Date.now().toString());
      }

      // SÓ considera como retorno real quando vem DE background → active.
      // Bloqueia IMEDIATAMENTE se biometria estiver habilitada
      // (LOCK_AFTER_MS = 0 → qualquer saída e retorno exige Face ID).
      if (prev === 'background' && nextState === 'active') {
        // Não re-bloqueia se o "background" foi causado pelo próprio prompt
        // biométrico (em voo) ou se acabamos de desbloquear. Sem isso, abre
        // um segundo popup ao retornar do prompt.
        if (authInFlightRef.current || Date.now() < suppressRelockUntilRef.current) {
          return;
        }
        const enabled = await SecureStore.getItemAsync(SECURE_KEY_ENABLED);
        if (enabled === 'true') {
          setIsLocked(true);
        }
      }
    });

    return () => sub.remove();
  }, []);

  // ── Autenticação biométrica ──
  const unlock = useCallback(async (useDevicePasscode = false): Promise<boolean> => {
    // Evita 2 prompts simultâneos (cold start + retorno de background).
    if (authInFlightRef.current) return false;
    authInFlightRef.current = true;
    try {
      // Tentativa normal = biometria pura (disableDeviceFallback=true) → só a
      // animação nativa do Face ID, sem 2º popup.
      // Tentativa via "código do dispositivo" (fallback após falha) →
      // disableDeviceFallback=false: iOS oferece o código. Se desbloquear assim,
      // a PRÓXIMA sessão exige login com e-mail/senha.
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         'Acesse o OLI Health Hub',
        cancelLabel:           'Cancelar',
        disableDeviceFallback: !useDevicePasscode,
      });

      if (result.success) {
        if (useDevicePasscode) {
          await SecureStore.setItemAsync(SECURE_KEY_FORCE_PWD, 'true');
        }
        setIsLocked(false);
        await SecureStore.deleteItemAsync(SECURE_KEY_BG_TIME);
      }
      return result.success;
    } catch {
      return false;
    } finally {
      // Janela de supressão: cobre a transição background→active disparada
      // pelo fechamento do próprio prompt biométrico.
      suppressRelockUntilRef.current = Date.now() + 2000;
      authInFlightRef.current = false;
    }
  }, []);

  // ── Ativar biometria (pede confirmação imediata) ──
  const enableBiometric = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirme sua identidade para ativar o bloqueio biométrico',
      cancelLabel:   'Cancelar',
    });
    if (result.success) {
      await SecureStore.setItemAsync(SECURE_KEY_ENABLED, 'true');
      // Limpa qualquer bgTime anterior — evita lock imediato ao mudar de tela
      await SecureStore.deleteItemAsync(SECURE_KEY_BG_TIME);
      setBiometricEnabled(true);
      setIsLocked(false);
    }
    return result.success;
  }, []);

  // ── Desativar biometria ──
  const disableBiometric = useCallback(async (): Promise<void> => {
    await SecureStore.deleteItemAsync(SECURE_KEY_ENABLED);
    setBiometricEnabled(false);
    setIsLocked(false);
  }, []);

  return {
    isLocked,
    biometricAvailable,
    biometricEnabled,
    unlock,
    enableBiometric,
    disableBiometric,
  };
}
