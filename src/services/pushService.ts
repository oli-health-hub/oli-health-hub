/**
 * pushService.ts
 *
 * Registro de push token remoto (Expo Push) no Supabase.
 * Diferente do notificationService (notificações LOCAIS agendadas pelo device),
 * aqui o token permite o SERVIDOR enviar mensagens — reengajamento, lembretes,
 * novidades — mesmo com o app fechado há dias.
 *
 * Envio server-side: edge function `send-push` (Admin/cron), nunca do app.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const EAS_PROJECT_ID = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

/**
 * Registra (ou atualiza) o Expo push token do device pro profissional logado.
 * Silencioso em caso de erro — push é best-effort, nunca bloqueia o app.
 * Chamar após login/boot com sessão ativa e permissão de notificação concedida.
 */
export async function registerPushToken(professionalId: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    if (!EAS_PROJECT_ID) return;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    if (!data) return;

    await supabase
      .from('push_tokens')
      .upsert(
        { professional_id: professionalId, token: data, platform: Platform.OS, updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      );
  } catch {
    // Expo Go não suporta push remoto (SDK 53+) e devices sem Google Play
    // Services falham no getExpoPushTokenAsync — ignorar é o comportamento certo.
  }
}

/** Remove os tokens do profissional neste device — chamar no signOut. */
export async function unregisterPushToken(professionalId: string): Promise<void> {
  try {
    if (!EAS_PROJECT_ID) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    if (!data) return;
    await supabase.from('push_tokens').delete().eq('professional_id', professionalId).eq('token', data);
  } catch {
    // best-effort
  }
}
