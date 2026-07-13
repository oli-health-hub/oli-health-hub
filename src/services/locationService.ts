/**
 * locationService.ts
 *
 * Captura de localização SUTIL — 1x, só pra saber de qual cidade/estado o
 * profissional é (não é tracking contínuo, não guarda coordenadas).
 * Preenche profiles.cidade_uf automaticamente quando ele ainda está vazio.
 *
 * ⚠️ Requer rebuild nativo (expo-location adicionado, permissão nova) —
 * inerte até a próxima build ir pra loja.
 */

import * as Location from 'expo-location';
import { supabase } from './supabase';

/**
 * Pede permissão (se ainda não decidida) e, se concedida, resolve cidade/UF
 * via reverse geocode e salva em profiles.cidade_uf — só se estiver vazio.
 * Silencioso em qualquer falha (localização é acessório, nunca bloqueia o app).
 */
export async function captureCityFromLocationOnce(professionalId: string, cidadeAtual: string | null): Promise<string | null> {
  if (cidadeAtual) return null; // já preenchido (manual ou onboarding) — não sobrescreve

  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    let granted = status === 'granted';

    if (status === 'undetermined') {
      const req = await Location.requestForegroundPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return null;

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const [place] = await Location.reverseGeocodeAsync({
      latitude:  position.coords.latitude,
      longitude: position.coords.longitude,
    });
    if (!place?.city || !place.region) return null;

    const cidadeUf = `${place.city} / ${place.region}`;
    await supabase.from('profiles').update({ cidade_uf: cidadeUf }).eq('id', professionalId);
    return cidadeUf;
  } catch {
    return null; // permissão negada, GPS desligado, sem sinal — tudo bem, é acessório
  }
}
