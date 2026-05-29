import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const LOCK_AFTER_MS      = 5 * 60 * 1000; // 5 minutos em background
const SECURE_KEY_ENABLED = 'oli_biometric_enabled';
const SECURE_KEY_BG_TIME = 'oli_background_time';

export interface AppLockState {
  isLocked:           boolean;
  biometricAvailable: boolean;
  biometricEnabled:   boolean;
  unlock:             () => Promise<boolean>;
  enableBiometric:    () => Promise<boolean>;
  disableBiometric:   () => Promise<void>;
}

export function useAppLock(): AppLockState {
  const [isLocked,           setIsLocked]           = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled,   setBiometricEnabled]   = useState(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Verifica suporte a biometria no dispositivo ──
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      const stored = await SecureStore.getItemAsync(SECURE_KEY_ENABLED);
      setBiometricEnabled(stored === 'true');
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

      // SÓ considera como retorno real quando vem DE background → active
      if (prev === 'background' && nextState === 'active') {
        const bgTimeStr = await SecureStore.getItemAsync(SECURE_KEY_BG_TIME);
        const bgTime    = bgTimeStr ? parseInt(bgTimeStr, 10) : 0;
        const elapsed   = Date.now() - bgTime;
        const enabled   = await SecureStore.getItemAsync(SECURE_KEY_ENABLED);

        if (enabled === 'true' && bgTime > 0 && elapsed >= LOCK_AFTER_MS) {
          setIsLocked(true);
        }
      }
    });

    return () => sub.remove();
  }, []);

  // ── Autenticação biométrica ──
  const unlock = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:   'Acesse o OLI Health Hub',
        cancelLabel:     'Cancelar',
        fallbackLabel:   'Usar senha do dispositivo',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        await SecureStore.deleteItemAsync(SECURE_KEY_BG_TIME);
      }
      return result.success;
    } catch {
      return false;
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
