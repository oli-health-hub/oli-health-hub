/**
 * notificationService.ts
 *
 * Gerencia notificações locais agendadas do OLI Health Hub.
 * Funciona mesmo com o app minimizado ou encerrado.
 *
 * Notificações agendadas na sessão:
 *   1. SESSION_ENDING_SOON   — 5 min antes do fim da sessão
 *   2. SESSION_ENDED         — exato momento do fim (buffer começa)
 *   3. BUFFER_URGENT         — quando há próxima reserva, alerta no buffer
 *
 * Todas são canceladas no checkout.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// IDs fixos para poder cancelar individualmente
const ID_ENDING_SOON  = 'oli_session_ending_soon';
const ID_ENDED        = 'oli_session_ended';
const ID_BUFFER       = 'oli_buffer_urgent';
const ID_LOW_BALANCE  = 'oli_low_balance';

// Configura o comportamento quando chega notificação com app em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Permissão ─────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('oli_session', {
      name:       'Sessão de Sala',
      importance: Notifications.AndroidImportance.HIGH,
      sound:      'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('oli_alerts', {
      name:       'Alertas OLI',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound:      'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Agendamento de sessão ─────────────────────────────────────────────────────

export interface SessionNotificationParams {
  sessionEndTime:      Date;
  roomName:            string;
  hasNextReservation?: boolean;
}

/**
 * Agenda as notificações de uma sessão.
 * Chamado em startSession() / ao iniciar uso da sala.
 */
export async function scheduleSessionNotifications(params: SessionNotificationParams): Promise<void> {
  const { sessionEndTime, roomName, hasNextReservation } = params;

  // Cancela quaisquer notificações anteriores da sessão
  await cancelSessionNotifications();

  const now    = Date.now();
  const endMs  = sessionEndTime.getTime();
  const fiveMinBefore = endMs - 5 * 60 * 1000;

  // 1. Aviso 5 min antes do fim
  if (fiveMinBefore > now + 10_000) {
    await Notifications.scheduleNotificationAsync({
      identifier: ID_ENDING_SOON,
      content: {
        title: '⏰ Sessão encerrando em 5 minutos',
        body:  `${roomName} — prepare-se para o checkout.`,
        sound: 'default',
        data:  { type: 'SESSION_ENDING_SOON' },
        ...(Platform.OS === 'android' && { channelId: 'oli_session' }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fiveMinBefore) },
    });
  }

  // 2. Sessão encerrada (buffer começa)
  if (endMs > now + 10_000) {
    await Notifications.scheduleNotificationAsync({
      identifier: ID_ENDED,
      content: {
        title: '🏁 Horário encerrado',
        body:  hasNextReservation
          ? `${roomName} — outro médico aguarda. Faça checkout agora.`
          : `${roomName} — sessão encerrada. Faça checkout quando quiser.`,
        sound: 'default',
        data:  { type: 'SESSION_ENDED' },
        ...(Platform.OS === 'android' && { channelId: 'oli_session' }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: sessionEndTime },
    });
  }

  // 3. Alerta de buffer urgente (10 min após encerramento, só se há próxima reserva)
  if (hasNextReservation) {
    const bufferAlert = endMs + 10 * 60 * 1000;
    if (bufferAlert > now + 10_000) {
      await Notifications.scheduleNotificationAsync({
        identifier: ID_BUFFER,
        content: {
          title: '🚨 Checkout urgente',
          body:  `Próxima reserva chegando — por favor saia da ${roomName} agora.`,
          sound: 'default',
          data:  { type: 'BUFFER_URGENT' },
          ...(Platform.OS === 'android' && { channelId: 'oli_session' }),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(bufferAlert) },
      });
    }
  }
}

/**
 * Cancela todas as notificações agendadas da sessão atual.
 * Chamado no checkout.
 */
export async function cancelSessionNotifications(): Promise<void> {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(ID_ENDING_SOON).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(ID_ENDED).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(ID_BUFFER).catch(() => {}),
  ]);
}

// ── Notificação de saldo baixo ────────────────────────────────────────────────

/**
 * Dispara imediatamente uma notificação de saldo baixo.
 * Chamada quando o saldo de horas cai abaixo de 2h.
 */
export async function notifyLowBalance(remainingMinutes: number): Promise<void> {
  const h   = Math.floor(remainingMinutes / 60);
  const min = remainingMinutes % 60;
  const label = h > 0 ? `${h}h${min > 0 ? ` ${min}min` : ''}` : `${min} minutos`;

  await Notifications.scheduleNotificationAsync({
    identifier: ID_LOW_BALANCE,
    content: {
      title: '⚠️ Saldo de horas baixo',
      body:  `Restam ${label} no seu pacote. Compre mais horas para continuar.`,
      sound: 'default',
      data:  { type: 'LOW_BALANCE' },
      ...(Platform.OS === 'android' && { channelId: 'oli_alerts' }),
    },
    trigger: null, // imediata
  });
}

// ── Listener de toque na notificação ─────────────────────────────────────────

type NotificationCallback = (type: string) => void;

export function addNotificationResponseListener(cb: NotificationCallback): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const type = response.notification.request.content.data?.type as string;
    if (type) cb(type);
  });
  return () => sub.remove();
}
