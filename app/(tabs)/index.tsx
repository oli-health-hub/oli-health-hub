import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, Alert, Image, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore, COST_PER_MINUTE } from '../../src/store/appStore';
import { useAuthStore } from '../../src/store/authStore';
import { usePatientStore } from '../../src/store/patientStore';
import { useTimer } from '../../src/hooks/useTimer';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import {
  formatElapsedTime, formatRemainingTime,
  formatHour, formatCurrency, formatDate,
} from '../../src/utils/formatters';
import type { Reservation, ReservationStatus, Patient } from '../../src/models/types';
import { QRScannerModal } from '../../src/components/QRScannerModal';
import { ReferralPromoModal } from '../../src/components/ReferralPromoModal';
import { CalendlyVisitBadge } from '../../src/components/CalendlyVisitBadge';
import { OlicoinsBadge } from '../../src/components/OlicoinsBadge';
import { ProfileCompletionCard } from '../../src/components/ProfileCompletionCard';
import { OlicoinsToast } from '../../src/components/OlicoinsToast';
import { reconcileActionObjectives } from '../../src/services/olicoinsService';
import { reconcileAchievements } from '../../src/services/achievementsService';
import { registerPushToken } from '../../src/services/pushService';
import { fetchHourBalance } from '../../src/services/financeiroService';
import type { HourBalance } from '../../src/services/financeiroService';
import { sendNPS } from '../../src/services/npsService';
import { supabase } from '../../src/services/supabase';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type AlertConfig = {
  icon:     string;
  color:    string;
  title:    string;
  message:  string;
  primary:  string;
  secondary?: string;
};

const ALERT_CONFIG: Record<string, AlertConfig> = {
  bufferUrgent: {
    icon:      'time-outline',
    color:     colors.oliRed,
    title:     'Tempo Esgotado',
    message:   'Outro profissional reservou esta sala. Você precisa fazer checkout em breve.',
    primary:   'Fazer Checkout',
    secondary: 'Continuar na Sala',
  },
  bufferFriendly: {
    icon:      'checkmark-circle-outline',
    color:     colors.oliGreen,
    title:     'Sessão Encerrada',
    message:   'Seu horário terminou, mas a sala está livre. Deseja continuar ou fazer checkout?',
    primary:   'Fazer Checkout',
    secondary: 'Continuar na Sala',
  },
  overtimeAdded: {
    icon:      'add-circle-outline',
    color:     colors.oliGold,
    title:     '+30 Minutos Adicionados',
    message:   'Um bloco extra de 30 minutos foi adicionado à sua sessão.',
    primary:   'Entendido',
    secondary: 'Fazer Checkout',
  },
  checkoutSuccess: {
    icon:      'checkmark-done-circle-outline',
    color:     colors.oliGreen,
    title:     'Checkout Realizado',
    message:   'Sua sessão foi encerrada com sucesso. Até logo!',
    primary:   'Fechar',
  },
};

// ─── Status dos agendamentos ─────────────────────────────────────────────────

const STATUS_BADGE: Record<ReservationStatus, { label: string; color: string; bg: string }> = {
  agendado:  { label: 'Agendado',  color: colors.gray,     bg: `${colors.gray}15`     },
  em_uso:    { label: 'Em uso',    color: colors.oliGreen, bg: `${colors.oliGreen}1A` },
  concluido: { label: 'Concluído', color: colors.oliGreen, bg: `${colors.oliGreen}15` },
  cancelado: { label: 'Cancelado', color: colors.oliRed,   bg: `${colors.oliRed}15`   },
};

function deriveStatus(res: Reservation, isActiveSession: boolean): ReservationStatus {
  if (res.status === 'concluido') return 'concluido';
  if (res.status === 'cancelado') return 'cancelado';
  if (res.status === 'em_uso' || isActiveSession) return 'em_uso';
  return 'agendado';
}

// ─── Cálculo de atraso ───────────────────────────────────────────────────────
// Positivo = atrasado em relação ao horário, negativo = adiantado.

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

interface AvgResult { avg: number; count: number; isEstimated: boolean }

function computeAvgConsultationMinutes(reservations: Reservation[]): AvgResult | null {
  // Prioridade 1: tempos reais rastreados (início e fim conhecidos)
  const tracked = reservations.filter(r => r.consultationStartedAt && r.consultationEndedAt);
  if (tracked.length > 0) {
    const total = tracked.reduce((s, r) =>
      s + new Date(r.consultationEndedAt!).getTime() - new Date(r.consultationStartedAt!).getTime(), 0);
    return { avg: Math.round(total / tracked.length / 60_000), count: tracked.length, isEstimated: false };
  }
  // Prioridade 2: duração programada das consultas concluídas ou em andamento
  const done = reservations.filter(r => r.status === 'concluido' || r.status === 'em_uso');
  const pool = done.length > 0 ? done : reservations;
  if (pool.length === 0) return null;
  const total = pool.reduce((s, r) =>
    s + new Date(r.endTime).getTime() - new Date(r.startTime).getTime(), 0);
  return { avg: Math.round(total / pool.length / 60_000), count: pool.length, isEstimated: true };
}

/**
 * Calcula o atraso em minutos relativo à duração padrão de consulta do Communicare.
 *  > 0 = atrasado  |  < 0 = adiantado  |  0 = no horário
 *
 * Consulta ativa: compara agora vs. (início_real + stdDuration).
 * Reconhece a consulta ativa pelo status explícito OU pela sessão em curso (isSessionActive).
 *
 * Entre consultas: usa a deriva média das consultas concluídas com tempo real rastreado.
 * Nunca calcula a distância até o próximo slot — isso daria valores enganosos
 * (ex.: "119 min adiantado" quando o próximo paciente está a 2h).
 */
function computeDelayMinutes(
  reservations:    Reservation[],
  stdDurationMin:  number,
  isSessionActive: boolean,
): number {
  const now = Date.now();

  // ── Consulta ativa ──────────────────────────────────────────────────────────
  // Prioridade: status explícito. Fallback: primeira reserva quando sessão está ativa.
  const explicitActive = reservations.find(r => r.status === 'em_uso');
  const active         = explicitActive ?? (isSessionActive ? reservations[0] : undefined);

  if (active) {
    const startRef    = active.consultationStartedAt ?? active.startTime;
    const expectedEnd = new Date(startRef).getTime() + stdDurationMin * 60_000;
    return Math.floor((now - expectedEnd) / 60_000);
  }

  // ── Entre consultas: deriva média das concluídas com tempo real ─────────────
  // "Adiantado" = consultas encerrando antes do padrão.
  // "Atrasado"  = consultas passando do padrão.
  // Sem dados reais → neutro (0), evita números absurdos com base nos slots.
  const tracked = reservations.filter(r => r.consultationStartedAt && r.consultationEndedAt);
  if (tracked.length === 0) return 0;

  const totalDrift = tracked.reduce((sum, r) => {
    const actual = new Date(r.consultationEndedAt!).getTime()
                 - new Date(r.consultationStartedAt!).getTime();
    return sum + actual / 60_000 - stdDurationMin;
  }, 0);

  return Math.round(totalDrift / tracked.length);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const {
    userName, userPlan, rooms, todayReservations,
    hasNextReservation, nextReservationTime,
    sessionStartTime,
    consultationDurationMinutes,
    checkout, cancelReservation, occupyCurrentRoom,
    endRoomUse, startSession,
  } = useAppStore();

  const { session, profile, setProfile } = useAuthStore();
  const timer = useTimer();

  const [showQR,              setShowQR]              = useState(false);
  const [alertKey,            setAlertKey]            = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [hourBalance,         setHourBalance]         = useState<HourBalance | null>(null);
  const [showNPSPicker,       setShowNPSPicker]       = useState(false);
  const [npsSendingId,        setNpsSendingId]        = useState<string | null>(null);
  const [showReferralPromo,   setShowReferralPromo]   = useState(false);
  const [calendlyDismissed,   setCalendlyDismissed]   = useState(false);
  const [objectivesToast,     setObjectivesToast]     = useState<{ amount: number } | null>(null);

  // Registra o Expo push token do device pra este profissional (push remoto).
  useEffect(() => {
    const professionalId = session?.user?.id;
    if (!professionalId) return;
    void registerPushToken(professionalId);
  }, [session?.user?.id]);

  // Reconcilia objetivos de ação + conquistas por quantidade uma vez por sessão —
  // credita Olicoins de coisas que o profissional já fez (mesmo antes da feature existir).
  useEffect(() => {
    const professionalId = session?.user?.id;
    if (!professionalId) return;
    Promise.all([
      reconcileActionObjectives(professionalId),
      reconcileAchievements(professionalId),
    ]).then(([objectives, achievements]) => {
      const amount =
        objectives.newlyEarned.reduce((sum, o) => sum + o.pontos, 0) +
        achievements.newlyEarned.reduce((sum, a) => sum + a.tier.pontos, 0);
      if (amount === 0) return;
      setObjectivesToast({ amount });
      setTimeout(() => setObjectivesToast(null), 2000);
    });
  }, [session?.user?.id]);

  // Popup de indicação — aparece UMA vez (foco no primeiro acesso ao dashboard).
  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('@oli:referral_promo_seen');
        if (!seen) setShowReferralPromo(true);
      } catch { /* silencioso */ }
    })();
  }, []);

  const dismissReferralPromo = useCallback(async () => {
    setShowReferralPromo(false);
    try { await AsyncStorage.setItem('@oli:referral_promo_seen', '1'); } catch { /* nada */ }
  }, []);

  const handleVisitaAgendadaOpen = useCallback(async () => {
    if (!session?.user?.id || !profile) return;
    const agora = new Date().toISOString();
    setProfile({ ...profile, visita_solicitada_em: agora });
    await supabase.from('profiles').update({ visita_solicitada_em: agora }).eq('id', session.user.id);
  }, [session, profile]);

  const goToReferral = useCallback(async () => {
    await dismissReferralPromo();
    router.push('/indicacao');
  }, [dismissReferralPromo, router]);
  const prevPhaseRef = useRef<typeof timer.phase>('normal');

  const { patients } = usePatientStore();
  // Os 6 pacientes mais recentes (por data de cadastro) para o picker de NPS
  const recentPatients = [...patients]
    .sort((a, b) => new Date(b.dataCadastro).getTime() - new Date(a.dataCadastro).getTime())
    .slice(0, 6);

  // Busca saldo de horas do Supabase (apenas hour_users com pacote ativo)
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    fetchHourBalance(userId)
      .then(setHourBalance)
      .catch(() => {});  // silencioso — widget simplesmente não aparece
  }, [session?.user?.id]);

  // Auto-inicia o timer quando o horário da primeira reserva chega
  useEffect(() => {
    if (sessionStartTime) return;

    // Ignora reservas já encerradas — evita reiniciar timer após checkout
    const pending = todayReservations.filter(
      r => r.status !== 'concluido' && r.status !== 'cancelado',
    );
    if (pending.length === 0) return;

    const firstRes  = pending[0];
    const startTime = new Date(firstRes.startTime);
    const endTime   = new Date(firstRes.endTime);
    const msUntil   = startTime.getTime() - Date.now();

    if (msUntil <= 0) {
      // Reserva já começou e sessão não está ativa — inicia imediatamente
      startSession(startTime, endTime);
      return;
    }

    // Agenda o início para o momento exato da reserva
    const timeoutId = setTimeout(() => {
      startSession(startTime, endTime);
    }, msUntil);

    return () => clearTimeout(timeoutId);
  }, [todayReservations, sessionStartTime, startSession]);

  // Dispara alerta ao mudar de fase
  useEffect(() => {
    if (timer.phase !== prevPhaseRef.current) {
      if (timer.phase === 'buffer')   setAlertKey(hasNextReservation ? 'bufferUrgent' : 'bufferFriendly');
      if (timer.phase === 'overtime') setAlertKey('overtimeAdded');
      prevPhaseRef.current = timer.phase;
    }
  });


  // Verifica se há salas alternativas disponíveis para o próximo profissional
  const currentRoomName      = todayReservations[0]?.roomName;
  const hasAlternativeRooms  = rooms.some(r => r.isAvailable && r.name !== currentRoomName);
  // Pode continuar se: não há próxima reserva OU há sala alternativa para remanejar
  const canContinueInRoom    = !hasNextReservation || hasAlternativeRooms;
  // Sala está em modo "uso continuado" quando o profissional optou por continuar após o timer
  const isRoomExtended       = !!rooms.find(r => r.name === currentRoomName)?.occupiedBy;

  const urgentBuffer = timer.phase === 'buffer' && hasNextReservation;
  const accentColor  = urgentBuffer || timer.phase === 'overtime' ? colors.oliRed : colors.oliGreen;

  const handleAlertPrimary = useCallback(() => {
    if (!alertKey) return;
    if (alertKey === 'bufferUrgent' || alertKey === 'bufferFriendly') {
      // Primário = Fazer Checkout
      setAlertKey(null);
      setShowQR(true);
    } else {
      setAlertKey(null);
    }
  }, [alertKey]);

  const handleAlertSecondary = useCallback(() => {
    if (!alertKey) return;
    if (alertKey === 'overtimeAdded') {
      // Secundário = Fazer Checkout
      setAlertKey(null);
      setShowQR(true);
    } else {
      // Buffer: Continuar na Sala → marca sala como ocupada pelo profissional
      const roomName = todayReservations[0]?.roomName;
      if (roomName) occupyCurrentRoom(roomName, userName);
      setAlertKey(null);
    }
  }, [alertKey, todayReservations, occupyCurrentRoom, userName]);

  const handleCheckout = useCallback(() => {
    setShowQR(false);

    // Marca a reserva ativa como concluída ANTES de limpar a sessão,
    // para que o useEffect de auto-start não a releia e reinicie o timer.
    const activeRes =
      todayReservations.find(r => r.status === 'em_uso') ??
      todayReservations.find(r => r.status !== 'concluido' && r.status !== 'cancelado');
    if (activeRes) endRoomUse(activeRes.id);

    checkout();

    // Abre picker NPS se houver pacientes cadastrados; caso contrário alert padrão
    setTimeout(() => {
      if (patients.length > 0) {
        setShowNPSPicker(true);
      } else {
        setAlertKey('checkoutSuccess');
      }
    }, 300);
  }, [checkout, endRoomUse, todayReservations, patients.length]);

  const handleNPSSelect = useCallback(async (patient: Patient) => {
    const professionalId = session?.user?.id;
    if (!professionalId) return;
    setNpsSendingId(patient.id);
    try {
      await sendNPS(patient, professionalId);
    } catch {
      // falha silenciosa — NPS não é bloqueante
    } finally {
      setNpsSendingId(null);
      setShowNPSPicker(false);
      setAlertKey('checkoutSuccess');
    }
  }, [session?.user?.id]);


  const handleCancelReservation = useCallback((id: string) => {
    Alert.alert(
      'Cancelar Reserva',
      'Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser desfeita.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: () => {
            cancelReservation(id);
            setSelectedReservation(null);
          },
        },
      ],
    );
  }, [cancelReservation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Olá, {userName}</Text>
            <Text style={styles.plan}>Plano {userPlan}</Text>
            {session?.user?.id && <OlicoinsBadge professionalId={session.user.id} />}
          </View>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => router.push('/perfil')}
            accessibilityLabel="Abrir perfil do profissional"
          >
            {profile?.foto_url ? (
              <Image source={{ uri: profile.foto_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarLetter}>
                {userName.split(' ').pop()?.charAt(0) ?? 'G'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Progresso do perfil (Olicoins) ── */}
        {profile && <ProfileCompletionCard profile={profile} />}

        {/* ── Widget: Saldo de Horas (apenas se houver pacote ativo) ── */}
        {hourBalance && (
          <View style={[
            styles.hourBalanceCard,
            shadows.small,
            hourBalance.baixo && styles.hourBalanceCardLow,
          ]}>
            <Ionicons
              name={hourBalance.baixo ? 'warning-outline' : 'time-outline'}
              size={18}
              color={hourBalance.baixo ? colors.oliRed : colors.oliGreen}
            />
            <View style={styles.hourBalanceInfo}>
              <Text style={styles.hourBalanceLabel}>Saldo de horas</Text>
              <Text style={[
                styles.hourBalanceValue,
                hourBalance.baixo && { color: colors.oliRed },
              ]}>
                {hourBalance.horasLivres}h disponíveis
              </Text>
            </View>
            {hourBalance.expiraEm && (
              <Text style={styles.hourBalanceExpiry}>
                expira {formatDate(hourBalance.expiraEm)}
              </Text>
            )}
          </View>
        )}

        {/* ── Timer Card ── */}
        <View style={[styles.timerCard, shadows.card]}>
          {timer.isRunning ? (
            <>
              <View style={[styles.badge, { backgroundColor: accentColor }]}>
                <Text style={styles.badgeText}>SALA EM USO</Text>
              </View>

              {/* Nome da sala atual */}
              {currentRoomName ? (
                <Text style={styles.currentRoom}>{currentRoomName}</Text>
              ) : null}

              <Text style={styles.timerDisplay}>
                {formatElapsedTime(timer.elapsedSeconds)}
              </Text>
              {sessionStartTime && (
                <Text style={styles.startTimeText}>
                  Início às {formatHour(sessionStartTime.toISOString())}
                </Text>
              )}
              <Text style={styles.costText}>
                Custo atual: {formatCurrency(timer.currentCost)}
              </Text>

              <View style={styles.divider} />

              {timer.phase === 'buffer' ? (
                urgentBuffer ? (
                  /* Buffer urgente: há reserva subsequente próxima */
                  <View style={styles.stateBlock}>
                    <Text style={[styles.stateTitle, { color: colors.oliRed }]}>BUFFER INICIADO</Text>
                    <Text style={styles.stateInfo}>Outro profissional reservou. Faça checkout em:</Text>
                    <Text style={[styles.remaining, { color: colors.oliRed }]}>
                      {formatRemainingTime(timer.remainingSeconds)}
                    </Text>
                  </View>
                ) : isRoomExtended ? (
                  /* Profissional optou por continuar — sala reservada para ele */
                  <View style={styles.stateBlock}>
                    <Text style={[styles.stateTitle, { color: colors.oliGreen }]}>SALA RESERVADA</Text>
                    <Text style={styles.stateInfo}>
                      {'Sala reservada para você até '}
                      <Text style={{ fontWeight: '700', color: colors.oliGreen }}>
                        {nextReservationTime ? formatHour(nextReservationTime) : '22:00'}
                      </Text>
                    </Text>
                  </View>
                ) : (
                  /* Buffer amigável: sala livre, pode continuar */
                  <View style={styles.stateBlock}>
                    <Text style={[styles.stateTitle, { color: colors.oliGreen }]}>SALA LIVRE</Text>
                    <Text style={styles.stateInfo}>Você pode continuar sem problema.</Text>
                    {nextReservationTime && (
                      <Text style={[styles.stateInfo, { color: colors.oliGreen }]}>
                        Disponível até {formatHour(nextReservationTime)}
                      </Text>
                    )}
                  </View>
                )
              ) : timer.phase === 'overtime' ? (
                <View style={styles.stateBlock}>
                  <Text style={[styles.stateTitle, { color: colors.oliRed }]}>BLOCO EXTRA ATIVO</Text>
                  <Text style={styles.stateInfo}>+30 minutos adicionados</Text>
                </View>
              ) : (
                /* Fase normal: conta regressiva + aviso se há próxima reserva */
                <View style={styles.stateBlock}>
                  <Text style={styles.stateInfo}>Tempo restante do bloco</Text>
                  <Text style={styles.remaining}>{formatRemainingTime(timer.remainingSeconds)}</Text>
                  {hasNextReservation && nextReservationTime && (
                    <Text style={[styles.stateInfo, { marginTop: 6, color: colors.oliGold }]}>
                      Próxima reserva às {formatHour(nextReservationTime)}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.checkoutBtn, { backgroundColor: accentColor }]}
                onPress={() => setShowQR(true)}
                accessibilityLabel="Fazer checkout da sala via QR Code"
              >
                <Ionicons name="qr-code-outline" size={20} color={colors.white} />
                <Text style={styles.checkoutBtnText}>Fazer Checkout (QR Code)</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={48}
                color={colors.oliLightGray}
                style={styles.idleIcon}
              />
              <Text style={styles.idleTitle}>Nenhuma sala em uso</Text>
              {todayReservations[0] ? (
                <>
                  <Text style={styles.idleInfo}>
                    Próxima reserva às {formatHour(todayReservations[0].startTime)} na{' '}
                    {todayReservations[0].roomName}.
                  </Text>
                  <Text style={styles.idleHint}>O timer iniciará automaticamente.</Text>
                </>
              ) : (
                <Text style={styles.idleInfo}>Você não tem reservas para hoje.</Text>
              )}
            </>
          )}
        </View>

        {/* ── Monitor de Atrasos ── */}
        <DelayMonitorCard
          reservations={todayReservations}
          stdDurationMin={consultationDurationMinutes}
          isSessionActive={timer.isRunning}
        />

        {/* Agenda de pacientes (Communicare) — desativada até a integração CC
            entrar em produção. Re-montar <CommunicareAgendaCard /> quando ligar. */}

        {/* ── Reservas de sala de hoje (OLI) ── */}
        <Text style={styles.sectionTitle}>Agendamentos de Hoje</Text>

        {todayReservations.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum agendamento encontrado.</Text>
        ) : (
          todayReservations.map((res, idx) => {
            const isActive = timer.isRunning && idx === 0;
            const status   = deriveStatus(res, isActive);
            const cfg      = STATUS_BADGE[status];
            return (
              <TouchableOpacity
                key={res.id}
                style={[styles.reservationRow, shadows.small]}
                onPress={() => setSelectedReservation(res)}
                accessibilityLabel={`Agendamento ${res.roomName} às ${formatHour(res.startTime)}, ${cfg.label}. Toque para opções.`}
              >
                <View style={styles.resLeft}>
                  <Text style={styles.resRoom}>{res.roomName}</Text>
                  <Text style={styles.resTime}>
                    {formatHour(res.startTime)} — {formatHour(res.endTime)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                  {status === 'em_uso' && <View style={styles.statusDot} />}
                  <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
                    {cfg.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

      </ScrollView>

      <OlicoinsToast visible={!!objectivesToast} amount={objectivesToast?.amount ?? 0} />

      {/* ── Badge flutuante: Agendar visita (some após 1º agendamento) ── */}
      <CalendlyVisitBadge
        visible={!!profile && !profile.visita_solicitada_em && !calendlyDismissed}
        onOpen={handleVisitaAgendadaOpen}
        onDismiss={() => setCalendlyDismissed(true)}
      />

      {/* ── Modal: Alerta de Timer ── */}
      <Modal visible={!!alertKey} animationType="fade" transparent>
        {alertKey && (
          <TimerAlertModal
            config={ALERT_CONFIG[alertKey]}
            onPrimary={handleAlertPrimary}
            onSecondary={ALERT_CONFIG[alertKey].secondary ? handleAlertSecondary : undefined}
            canContinueInRoom={canContinueInRoom}
          />
        )}
      </Modal>

      {/* ── Popup: Programa de Indicação (1º acesso) ── */}
      <ReferralPromoModal
        visible={showReferralPromo}
        onIndicar={goToReferral}
        onClose={dismissReferralPromo}
      />

      {/* ── Modal: QR Code Checkout ── */}
      <Modal visible={showQR} animationType="slide" presentationStyle="fullScreen">
        <QRScannerModal onCheckout={handleCheckout} onClose={() => setShowQR(false)} />
      </Modal>

      {/* ── Modal: NPS picker pós-checkout ── */}
      <Modal visible={showNPSPicker} animationType="slide" transparent>
        <View style={npsStyles.overlay}>
          <View style={npsStyles.sheet}>
            {/* Handle */}
            <View style={npsStyles.handle} />

            <Text style={npsStyles.title}>Checkout realizado! ✅</Text>
            <Text style={npsStyles.sub}>Para quem foi o atendimento? Vamos enviar uma pesquisa rápida de satisfação.</Text>

            <FlatList
              data={recentPatients}
              keyExtractor={p => p.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={npsStyles.patientRow}
                  onPress={() => handleNPSSelect(item)}
                  disabled={npsSendingId !== null}
                  accessibilityLabel={`Selecionar paciente ${item.nome} para NPS`}
                >
                  <View style={npsStyles.patientAvatar}>
                    <Text style={npsStyles.patientAvatarText}>
                      {item.nome.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={npsStyles.patientInfo}>
                    <Text style={npsStyles.patientName}>{item.nome}</Text>
                    <Text style={npsStyles.patientPhone}>{item.telefone}</Text>
                  </View>
                  {npsSendingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.oliGreen} />
                  ) : (
                    <Ionicons name="send-outline" size={18} color={colors.oliGreen} />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={npsStyles.sep} />}
            />

            <TouchableOpacity
              style={npsStyles.skipBtn}
              onPress={() => { setShowNPSPicker(false); setAlertKey('checkoutSuccess'); }}
              accessibilityLabel="Pular envio de NPS"
            >
              <Text style={npsStyles.skipText}>Pular — não enviar pesquisa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Opções de Reserva ── */}
      <Modal visible={!!selectedReservation} animationType="slide" transparent>
        {selectedReservation && (
          <ReservationOptionsModal
            reservation={selectedReservation}
            // Checkout só via QR/código no totem — não há encerramento manual aqui
            onConcluir={undefined}
            onReagendar={() => {
              setSelectedReservation(null);
              router.push('/(tabs)/agenda');
            }}
            onCancel={() => handleCancelReservation(selectedReservation.id)}
            onClose={() => setSelectedReservation(null)}
          />
        )}
      </Modal>

    </SafeAreaView>
  );
}

// ─── TimerAlertModal ──────────────────────────────────────────────────────────

function TimerAlertModal({
  config, onPrimary, onSecondary, canContinueInRoom,
}: {
  config:           AlertConfig;
  onPrimary:        () => void;
  onSecondary?:     () => void;
  canContinueInRoom: boolean;
}) {
  // O botão "Continuar na Sala" fica bloqueado se não houver sala alternativa
  const isSecondaryBlocked =
    config.secondary === 'Continuar na Sala' && !canContinueInRoom;

  return (
    <View style={alertStyles.overlay}>
      <View style={alertStyles.card}>
        <Ionicons
          name={config.icon as any}
          size={52}
          color={config.color}
          style={alertStyles.icon}
        />
        <Text style={alertStyles.title}>{config.title}</Text>
        <Text style={alertStyles.message}>{config.message}</Text>

        <TouchableOpacity
          style={[alertStyles.btnPrimary, { backgroundColor: config.color }]}
          onPress={onPrimary}
          accessibilityLabel={config.primary}
        >
          <Text style={alertStyles.btnPrimaryText}>{config.primary}</Text>
        </TouchableOpacity>

        {config.secondary && (
          <TouchableOpacity
            style={[
              alertStyles.btnSecondary,
              isSecondaryBlocked && alertStyles.btnSecondaryBlocked,
            ]}
            onPress={isSecondaryBlocked ? undefined : onSecondary}
            disabled={isSecondaryBlocked}
            accessibilityLabel={
              isSecondaryBlocked
                ? 'Continuar na Sala indisponível — reserva subsequente confirmada'
                : config.secondary
            }
          >
            <View style={alertStyles.btnSecondaryInner}>
              {isSecondaryBlocked && (
                <Ionicons name="lock-closed" size={14} color={colors.oliRed} />
              )}
              <Text style={[
                alertStyles.btnSecondaryText,
                { color: isSecondaryBlocked ? colors.oliRed : config.color },
                isSecondaryBlocked && alertStyles.btnSecondaryTextBlocked,
              ]}>
                {config.secondary}
              </Text>
            </View>
            {isSecondaryBlocked && (
              <Text style={alertStyles.blockedNote}>
                Reserva subsequente confirmada — sem salas disponíveis para remanejamento
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── ReservationOptionsModal ──────────────────────────────────────────────────

function ReservationOptionsModal({
  reservation, onConcluir, onReagendar, onCancel, onClose,
}: {
  reservation: Reservation;
  onConcluir?: () => void;
  onReagendar: () => void;
  onCancel:    () => void;
  onClose:     () => void;
}) {
  const options = [
    ...(onConcluir ? [{
      icon:  'checkmark-circle-outline',
      label: 'Marcar como Concluída',
      color: colors.oliGreen,
      onPress: onConcluir,
    }] : []),
    {
      icon:  'calendar-outline',
      label: 'Reagendar',
      color: colors.oliGold,
      onPress: onReagendar,
    },
    {
      icon:  'add-circle-outline',
      label: 'Adicionar ao Calendário',
      color: colors.oliDarkGray,
      onPress: () => {
        onClose();
        Alert.alert('Calendário', 'Reserva adicionada ao calendário.');
      },
    },
    {
      icon:  'trash-outline',
      label: 'Cancelar Reserva',
      color: colors.oliRed,
      onPress: onCancel,
    },
  ];

  return (
    <View style={optStyles.overlay}>
      <View style={optStyles.sheet}>
        <View style={optStyles.handle} />

        <View style={optStyles.header}>
          <View>
            <Text style={optStyles.room}>{reservation.roomName}</Text>
            <Text style={optStyles.time}>
              {formatHour(reservation.startTime)} — {formatHour(reservation.endTime)}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar opções">
            <Ionicons name="close-circle" size={28} color={colors.gray} />
          </TouchableOpacity>
        </View>

        <View style={optStyles.divider} />

        {options.map(opt => (
          <TouchableOpacity
            key={opt.label}
            style={optStyles.option}
            onPress={opt.onPress}
            accessibilityLabel={opt.label}
          >
            <Ionicons name={opt.icon as any} size={22} color={opt.color} />
            <Text style={[optStyles.optionLabel, { color: opt.color }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── DelayMonitorCard ─────────────────────────────────────────────────────────

const DELAY_ZONES = [
  { key: 'adiantado',   label: 'Adiantado',   minDelay: -Infinity, maxDelay: -8,       color: '#3AAFA9', bg: '#3AAFA915', icon: 'trending-up-outline'       },
  { key: 'no_horario',  label: 'No horário',  minDelay: -8,        maxDelay: 5,        color: '#5F7D67', bg: '#5F7D6715', icon: 'checkmark-circle-outline'  },
  { key: 'leve_atraso', label: 'Leve atraso', minDelay: 5,         maxDelay: 15,       color: '#B8893C', bg: '#B8893C15', icon: 'time-outline'               },
  { key: 'atrasado',    label: 'Atrasado',    minDelay: 15,        maxDelay: Infinity, color: '#D9534F', bg: '#D9534F15', icon: 'warning-outline'            },
] as const;

function DelayMonitorCard({
  reservations, stdDurationMin, isSessionActive,
}: {
  reservations:   Reservation[];
  stdDurationMin: number;
  isSessionActive: boolean;
}) {
  const [trackWidth, setTrackWidth] = useState(0);

  const delayMin   = computeDelayMinutes(reservations, stdDurationMin, isSessionActive);
  const zone       = DELAY_ZONES.find(z => delayMin >= z.minDelay && delayMin < z.maxDelay) ?? DELAY_ZONES[1];
  const clamped    = Math.max(-20, Math.min(20, delayMin));
  const ratio      = (clamped + 20) / 40; // 0 = muito adiantado, 1 = muito atrasado

  const absDelay   = Math.abs(delayMin);
  const delayLabel = delayMin < -1
    ? `${absDelay} min adiantado`
    : delayMin > 1
    ? `${absDelay} min de atraso`
    : 'Dentro do horário';

  const completed  = reservations.filter(r => r.status === 'concluido').length;
  const inProgress = reservations.find(r => r.status === 'em_uso');
  const avgResult  = computeAvgConsultationMinutes(reservations);

  return (
    <View style={[monitorStyles.card, shadows.small]}>
      <View style={monitorStyles.header}>
        <Text style={monitorStyles.title}>Monitor de Atendimentos</Text>
        <Ionicons name={zone.icon as any} size={18} color={zone.color} />
      </View>

      {/* Termômetro */}
      <View style={monitorStyles.trackWrap}>
        {/* Track: zonas coloridas */}
        <View
          style={monitorStyles.track}
          onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        >
          {DELAY_ZONES.map((z, i) => (
            <View
              key={z.key}
              style={[
                monitorStyles.trackZone,
                { backgroundColor: z.color + (zone.key === z.key ? '35' : '15') },
                i === 0                    && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                i === DELAY_ZONES.length-1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
              ]}
            />
          ))}
        </View>

        {/* Linha central (horário exato) */}
        <View style={monitorStyles.centerMark} />

        {/* Indicador */}
        {trackWidth > 0 ? (
          <View style={[monitorStyles.indicator, { left: Math.round(trackWidth * ratio) - 9 }]}>
            <View style={[monitorStyles.indicatorOuter, { borderColor: zone.color }]}>
              <View style={[monitorStyles.indicatorInner, { backgroundColor: zone.color }]} />
            </View>
          </View>
        ) : null}
      </View>

      {/* Rótulos */}
      <View style={monitorStyles.labelsRow}>
        <Text style={[monitorStyles.labelEdge, { color: '#3AAFA9' }]}>← Adiantado</Text>
        <Text style={monitorStyles.labelCenter}>No horário</Text>
        <Text style={[monitorStyles.labelEdge, { color: '#D9534F', textAlign: 'right' }]}>Atrasado →</Text>
      </View>

      {/* Sumário */}
      <View style={monitorStyles.summaryRow}>
        <View style={[monitorStyles.zoneBadge, { backgroundColor: zone.bg }]}>
          <Text style={[monitorStyles.zoneBadgeText, { color: zone.color }]}>{zone.label}</Text>
        </View>
        <Text style={monitorStyles.delayDetail}>{delayLabel}</Text>
      </View>

      {/* Contexto */}
      <Text style={monitorStyles.context}>
        {inProgress
          ? `Em andamento · ${completed > 0 ? `${completed} ${completed === 1 ? 'concluída' : 'concluídas'} hoje` : 'primeira do dia'}`
          : completed > 0
          ? `${completed} ${completed === 1 ? 'consulta concluída' : 'consultas concluídas'} hoje`
          : 'Nenhuma consulta iniciada'}
        {' · Meta: '}{formatDuration(stdDurationMin)}
      </Text>

      {/* Tempo médio vs meta */}
      {avgResult && (
        <>
          <View style={monitorStyles.divider} />
          <View style={monitorStyles.avgRow}>
            <Ionicons name="timer-outline" size={14} color={colors.oliLightGray} />
            <Text style={monitorStyles.avgLabel}>Tempo médio de consulta</Text>
            <Text style={[
              monitorStyles.avgValue,
              !avgResult.isEstimated && {
                color: avgResult.avg <= stdDurationMin
                  ? colors.oliGreen
                  : avgResult.avg <= stdDurationMin * 1.2
                  ? colors.oliGold
                  : colors.oliRed,
              },
            ]}>
              {formatDuration(avgResult.avg)}
            </Text>
            {!avgResult.isEstimated && avgResult.avg !== stdDurationMin && (
              <Text style={[
                monitorStyles.avgDelta,
                { color: avgResult.avg <= stdDurationMin ? colors.oliGreen : colors.oliRed },
              ]}>
                {avgResult.avg < stdDurationMin
                  ? `−${stdDurationMin - avgResult.avg} min`
                  : `+${avgResult.avg - stdDurationMin} min`}
              </Text>
            )}
          </View>
          <Text style={monitorStyles.avgSub}>
            {avgResult.isEstimated
              ? `Estimado com base nos slots · meta: ${formatDuration(stdDurationMin)}`
              : `${avgResult.count} ${avgResult.count === 1 ? 'atendimento real' : 'atendimentos reais'} · meta: ${formatDuration(stdDurationMin)}`}
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { paddingBottom: 40 },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  headerLeft:   { alignItems: 'flex-start', gap: spacing.xs },
  greeting:     { fontSize: 24, fontWeight: '700', color: colors.oliDarkGray },
  plan:         { fontSize: 13, fontWeight: '500', color: colors.oliGold, marginTop: 2 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: `${colors.oliGreen}26`, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarLetter: { fontSize: 20, fontWeight: '700', color: colors.oliGreen },
  avatarImg:    { width: 50, height: 50, borderRadius: 25 },

  // ── Saldo de horas ──────────────────────────────────────────────────────────
  hourBalanceCard:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, marginHorizontal: spacing.md, marginBottom: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.oliGreen },
  hourBalanceCardLow:  { borderLeftColor: colors.oliRed, backgroundColor: `${colors.oliRed}08` },
  hourBalanceInfo:     { flex: 1 },
  hourBalanceLabel:    { fontSize: 11, fontWeight: '600', color: colors.oliLightGray, textTransform: 'uppercase' },
  hourBalanceValue:    { fontSize: 15, fontWeight: '700', color: colors.oliGreen, marginTop: 1 },
  hourBalanceExpiry:   { fontSize: 11, color: colors.oliLightGray },

  timerCard:    { backgroundColor: colors.white, borderRadius: radius.xl, margin: spacing.md, padding: spacing.lg, alignItems: 'center' },
  badge:        { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 4, marginBottom: spacing.xs },
  badgeText:    { color: colors.white, fontSize: 12, fontWeight: '700' },
  currentRoom:  { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.sm },
  timerDisplay:  { fontSize: 56, fontWeight: '700', color: colors.oliDarkGray, fontVariant: ['tabular-nums'] },
  startTimeText: { fontSize: 13, color: colors.gray, marginTop: 2 },
  costText:      { fontSize: 16, fontWeight: '500', color: colors.gray, marginTop: 2 },
  divider:      { height: 1, backgroundColor: colors.border, width: '100%', marginVertical: spacing.md },

  stateBlock: { alignItems: 'center', marginBottom: spacing.sm },
  stateTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  stateInfo:  { fontSize: 14, color: colors.oliLightGray, textAlign: 'center' },
  remaining:  { fontSize: 24, fontWeight: '700', color: colors.oliDarkGray, marginTop: 4 },

  checkoutBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.lg, marginTop: spacing.sm, width: '100%' },
  checkoutBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  idleIcon:  { marginBottom: spacing.sm },
  idleTitle: { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.sm },
  idleInfo:  { fontSize: 14, color: colors.gray, textAlign: 'center' },
  idleHint:  { fontSize: 12, fontWeight: '500', color: colors.oliGold, marginTop: 4 },

  sectionTitle:   { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray, paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm },
  emptyText:      { fontSize: 14, color: colors.gray, paddingHorizontal: spacing.md },
  reservationRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radius.md, marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
  resLeft:         { flex: 1 },
  resRoom:         { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },
  resTime:         { fontSize: 14, color: colors.gray, marginTop: 2 },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  statusDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.oliGreen },
});

const alertStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card:    { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', width: '100%', maxWidth: 360 },
  icon:    { marginBottom: spacing.md },
  title:   { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center', marginBottom: spacing.sm },
  message: { fontSize: 15, color: colors.gray, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  btnPrimary:     { width: '100%', borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: spacing.sm },
  btnPrimaryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  btnSecondary:        { width: '100%', borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.md, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  btnSecondaryBlocked: { backgroundColor: `${colors.oliRed}15`, borderColor: `${colors.oliRed}60`, opacity: 0.85 },
  btnSecondaryInner:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnSecondaryText:    { fontSize: 16, fontWeight: '600' },
  btnSecondaryTextBlocked: { fontWeight: '700' },
  blockedNote:         { fontSize: 11, color: colors.oliRed, textAlign: 'center', marginTop: 6, lineHeight: 16, opacity: 0.9 },
});

const monitorStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginHorizontal: spacing.md,
    marginBottom:    spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:  { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray },

  trackWrap: { position: 'relative', height: 18, marginBottom: 6 },
  track: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    flexDirection: 'row', borderRadius: 6, overflow: 'hidden',
  },
  trackZone: { flex: 1, height: 18 },
  centerMark: {
    position: 'absolute', left: '50%', top: 2, bottom: 2,
    width: 1.5, backgroundColor: `${colors.gray}40`,
  },
  indicator: { position: 'absolute', top: -5 },
  indicatorOuter: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center' },
  indicatorInner: { width: 7, height: 7, borderRadius: 3.5 },

  labelsRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  labelEdge:   { flex: 1, fontSize: 10, fontWeight: '500' },
  labelCenter: { flex: 1, fontSize: 10, color: colors.gray, textAlign: 'center' },

  summaryRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  zoneBadge:     { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  zoneBadgeText: { fontSize: 12, fontWeight: '700' },
  delayDetail:   { fontSize: 13, color: colors.gray },

  context: { fontSize: 11, color: colors.oliLightGray },

  divider:      { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  avgRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avgLabel:     { flex: 1, fontSize: 12, color: colors.gray },
  avgValue:     { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray },
  avgDelta:     { fontSize: 11, fontWeight: '700' },
  avgSub:       { fontSize: 10, color: colors.oliLightGray, marginTop: 3 },
});

const optStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: 36 },
  handle:  { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  room:    { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  time:    { fontSize: 14, color: colors.gray, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  option:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  optionLabel: { fontSize: 16, fontWeight: '500' },
});

const npsStyles = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  handle:            { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  title:             { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center' },
  sub:               { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },
  patientRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12 },
  patientAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: `${colors.oliGreen}20`, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  patientAvatarText: { fontSize: 18, fontWeight: '700', color: colors.oliGreen },
  patientInfo:       { flex: 1 },
  patientName:       { fontSize: 15, fontWeight: '600', color: colors.oliDarkGray },
  patientPhone:      { fontSize: 12, color: colors.gray, marginTop: 2 },
  sep:               { height: 0.5, backgroundColor: colors.border },
  skipBtn:           { alignItems: 'center', paddingVertical: spacing.md },
  skipText:          { fontSize: 14, color: colors.gray, fontWeight: '500' },
});
