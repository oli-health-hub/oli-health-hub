import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

// Evita consultar o servidor de updates a cada volta rápida do background
const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Avisa quando há uma atualização OTA pronta para uso.
 *
 * - Consulta o EAS Update ao abrir e ao voltar do background (no máximo a cada 5 min).
 * - Se houver versão nova, baixa em segundo plano; `visible` vira true quando o download termina.
 * - `apply` reinicia o app já com a versão nova. `dismiss` esconde o aviso até a próxima abertura.
 * - Em desenvolvimento (Updates desativado) não faz nada.
 */
export function useUpdatePrompt() {
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const lastCheckRef = useRef(0);

  const check = useCallback(async () => {
    if (!Updates.isEnabled) return;
    const now = Date.now();
    if (now - lastCheckRef.current < MIN_CHECK_INTERVAL_MS) return;
    lastCheckRef.current = now;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) await Updates.fetchUpdateAsync();
    } catch {
      // Sem rede ou servidor indisponível — tenta de novo na próxima abertura
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const apply = useCallback(() => {
    Updates.reloadAsync().catch(() => {
      // Falha ao reiniciar: a versão nova é aplicada na próxima abertura
      setDismissed(true);
    });
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { visible: isUpdatePending && !dismissed, apply, dismiss };
}
