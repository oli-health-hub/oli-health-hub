/**
 * Communicare SSO helper.
 * Após login Supabase: dispara SSO CC silencioso, guarda JWT em SecureStore
 * e persiste em profiles.communicare_jwt para uso pelo edge proxy.
 *
 * Silencioso de verdade — não há UI, não há badge. Login OLI já confirma
 * identidade ao médico; SSO acontece em paralelo.
 */

import { secureStore as SecureStore } from '../utils/secureStoreWeb';
import { supabase } from './supabase';
import { ccSSO, ccIsConfigured } from './communicareApi';

// Cast para campos novos antes do regen de types após migração
// deno-lint-ignore no-explicit-any
const sb: any = supabase;

const SECURE_KEY_CC_JWT     = 'oli_cc_jwt';
const SECURE_KEY_CC_JWT_EXP = 'oli_cc_jwt_exp';

export async function ensureCommunicareSSO(profileId: string, cpf: string): Promise<void> {
  if (!ccIsConfigured()) return;
  if (!cpf || cpf.replace(/\D/g, '').length !== 11) return;

  // Verifica cache local
  const cachedExp = await SecureStore.getItemAsync(SECURE_KEY_CC_JWT_EXP);
  if (cachedExp && new Date(cachedExp).getTime() > Date.now() + 60_000) {
    return; // ainda válido (margem de 1 min)
  }

  try {
    const sso = await ccSSO(cpf.replace(/\D/g, ''));
    await SecureStore.setItemAsync(SECURE_KEY_CC_JWT,     sso.jwt);
    await SecureStore.setItemAsync(SECURE_KEY_CC_JWT_EXP, sso.expiresAt);

    // Persiste no profile pra edge proxy poder usar em chamadas server-side
    await sb
      .from('profiles')
      .update({
        communicare_id:      sso.professionalId,
        communicare_jwt:     sso.jwt,
        communicare_jwt_exp: sso.expiresAt,
      })
      .eq('id', profileId);
  } catch {
    // Falha silenciosa — sync por fila continua tentando
  }
}

export async function clearCommunicareSSO(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEY_CC_JWT);
  await SecureStore.deleteItemAsync(SECURE_KEY_CC_JWT_EXP);
}
