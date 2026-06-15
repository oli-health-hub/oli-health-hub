import { supabase } from '../services/supabase';

/**
 * Fluxo de recuperação de senha via deep link.
 *
 * O e-mail de reset (redirectTo = olihealthhub://nova-senha) chega como:
 *   olihealthhub://nova-senha#access_token=...&refresh_token=...&type=recovery
 *
 * Como detectSessionInUrl=false (evita conflito com Expo Router), o token NÃO
 * é consumido automaticamente — extraímos manualmente do fragmento e fazemos
 * setSession para abrir a sessão de recuperação antes de pedir a nova senha.
 */

interface RecoveryTokens {
  accessToken:  string;
  refreshToken: string;
}

/** Extrai tokens de recovery do fragmento (#) do deep link, ou null. */
export function parseRecoveryTokens(url: string): RecoveryTokens | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const fragment = url.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);

  if (params.get('type') !== 'recovery') return null;

  const accessToken  = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

/**
 * Se a URL for um link de recuperação, abre a sessão e retorna true
 * (chamador deve navegar para /nova-senha). Caso contrário, false.
 */
export async function handleRecoveryDeepLink(url: string | null): Promise<boolean> {
  if (!url) return false;
  const tokens = parseRecoveryTokens(url);
  if (!tokens) return false;

  const { error } = await supabase.auth.setSession({
    access_token:  tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  return !error;
}
