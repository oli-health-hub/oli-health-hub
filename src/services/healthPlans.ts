/**
 * Health Plans (convênios) — cache local + fonte CC.
 * Lista os convênios do Communicare, cacheada 24h em AsyncStorage.
 * Usada no dropdown de cadastro de paciente para padronizar com o CC.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ccListHealthPlans, ccIsConfigured, type CCHealthPlan } from './communicareApi';

const CACHE_KEY = '@oli:health_plans_v1';
const TTL_MS    = 24 * 3600_000;

interface CacheShape {
  fetchedAt: number;
  plans:     CCHealthPlan[];
}

export async function getHealthPlans(): Promise<CCHealthPlan[]> {
  // 1. cache válido?
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache: CacheShape = JSON.parse(raw);
      if (Date.now() - cache.fetchedAt < TTL_MS && cache.plans.length > 0) {
        return cache.plans;
      }
    }
  } catch { /* ignora cache corrompido */ }

  // 2. busca CC
  if (!ccIsConfigured()) return [];
  try {
    const plans = await ccListHealthPlans();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), plans }));
    return plans;
  } catch {
    // 3. fallback: cache antigo mesmo expirado
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) return (JSON.parse(raw) as CacheShape).plans;
    } catch { /* nada */ }
    return [];
  }
}
