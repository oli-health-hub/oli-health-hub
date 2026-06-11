/**
 * Captura e persistência do código de indicação.
 *
 * Fluxo:
 *   1. Indicado abre link `https://olihealthhub.com.br/baixar?ref=ABC123`
 *      ou deep link `olihealthhub://onboarding?ref=ABC123`.
 *   2. App captura o `ref` (Linking) e guarda em AsyncStorage.
 *   3. No onboarding, o código é lido, resolvido para o indicador (RPC) e
 *      pré-preenchido. Depois é limpo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

const PENDING_REFERRAL_KEY = '@oli:pending_referral_code';

/** Normaliza: maiúsculas, sem espaços. Códigos têm 6 chars alfanuméricos. */
function normalize(code: string): string {
  return code.trim().toUpperCase();
}

/** Extrai o parâmetro `ref` de uma URL de deep link / universal link. */
export function extractReferralCode(url: string | null): string | null {
  if (!url) return null;
  try {
    const { queryParams } = Linking.parse(url);
    const ref = queryParams?.ref;
    if (typeof ref === 'string' && ref.trim().length > 0) {
      return normalize(ref);
    }
  } catch {
    // URL malformada — ignora
  }
  return null;
}

/** Guarda o código pendente (não sobrescreve com valor vazio). */
export async function storePendingReferralCode(code: string): Promise<void> {
  const norm = normalize(code);
  if (!norm) return;
  try {
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, norm);
  } catch {
    // storage indisponível — silencioso
  }
}

/** Captura o código a partir de uma URL e persiste, se houver. */
export async function captureReferralFromUrl(url: string | null): Promise<void> {
  const code = extractReferralCode(url);
  if (code) await storePendingReferralCode(code);
}

/** Lê o código pendente, se houver. */
export async function getPendingReferralCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
  } catch {
    return null;
  }
}

/** Limpa o código pendente (após consumo no onboarding). */
export async function clearPendingReferralCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    // silencioso
  }
}
