import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { hasReservationCredit } from '../services/financeiroService';
import { colors, spacing, radius, shadows } from '../theme/designSystem';
import { formatHour } from '../utils/formatters';
import { notifyPatientEncaixe } from '../utils/whatsapp';
import { useAndroidBack } from '../hooks/useAndroidBack';
import type { Patient, Reservation, Room } from '../models/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SLOT_MINUTES = 30;

/** Próximos N dias úteis a partir de hoje (inclui hoje e sábado; exclui domingo). */
function nextWeekdays(count: number): Date[] {
  const days: Date[] = [];
  const cur = new Date(); cur.setHours(0, 0, 0, 0);
  while (days.length < count) {
    const dow = cur.getDay();
    if (dow !== 0) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Gera todos os slots de 30 min das 08:00 às 18:30.
 * Para hoje, começa a partir do próximo slot futuro.
 */
function buildAllSlots(date: Date): Date[] {
  const slots: Date[] = [];
  const dayStart = new Date(date); dayStart.setHours(8, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(18, 30, 0, 0);

  const now     = new Date();
  const isToday = date.toDateString() === now.toDateString();
  let cursor: Date;
  if (isToday) {
    const next = new Date(Math.ceil(now.getTime() / (SLOT_MINUTES * 60_000)) * (SLOT_MINUTES * 60_000));
    cursor = next > dayStart ? next : new Date(dayStart);
  } else {
    cursor = new Date(dayStart);
  }
  while (cursor <= dayEnd) {
    slots.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + SLOT_MINUTES * 60_000);
  }
  return slots;
}

/**
 * Verifica se um slot de tempo está coberto por alguma reserva do dia.
 * Uma reserva cobre o slot se: reservaInício <= slot < reservaFim
 */
function coveringReservation(slot: Date, reservations: Reservation[]): Reservation | undefined {
  return reservations.find(r => {
    const rStart = new Date(r.startTime).getTime();
    const rEnd   = new Date(r.endTime).getTime();
    return slot.getTime() >= rStart && slot.getTime() < rEnd;
  });
}

/**
 * Retorna as reservas cujo startTime cai na data selecionada.
 */
function reservationsForDate(date: Date, reservations: Reservation[]): Reservation[] {
  const dateStr = date.toDateString();
  return reservations.filter(r => new Date(r.startTime).toDateString() === dateStr);
}

/**
 * Verifica se uma sala está disponível num dado slot (sem reserva conflitante).
 * Considera buffer de 15 min após cada reserva.
 */
function isRoomFreeAtSlot(room: Room, slot: Date, reservations: Reservation[]): boolean {
  const BUFFER_MS = 15 * 60_000;
  const slotEnd   = slot.getTime() + SLOT_MINUTES * 60_000;
  return !reservations.some(r => {
    if (r.roomName !== room.name) return false;
    const rStart = new Date(r.startTime).getTime();
    const rEnd   = new Date(r.endTime).getTime() + BUFFER_MS;
    return slot.getTime() < rEnd && slotEnd > rStart;
  });
}

const DURATIONS = [
  { label: '30min', minutes: 30 },
  { label: '45min', minutes: 45 },
  { label: '1h',    minutes: 60 },
  { label: '1h30',  minutes: 90 },
  { label: '2h',    minutes: 120 },
];

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_SHORT   = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  paciente:  Patient;
  onClose:   () => void;
  onConfirm: () => void;
}

export function EncaixeModal({ paciente, onClose, onConfirm }: Props) {
  useAndroidBack(onClose);
  const { rooms, todayReservations, addReservation, userName } = useAppStore();
  const router = useRouter();

  const dates = useMemo(() => nextWeekdays(5), []);

  const [selectedDate,     setSelectedDate]     = useState<Date>(dates[0]);
  const [selectedTime,     setSelectedTime]     = useState<Date | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  /** Slot sem cobertura de reserva que o profissional tocou — exibe opção de reservar sala */
  const [pendingSlot,      setPendingSlot]      = useState<Date | null>(null);

  // Reservas do dia selecionado (filtra todayReservations + reservas adicionadas na sessão)
  const dayReservations = useMemo(
    () => reservationsForDate(selectedDate, todayReservations),
    [selectedDate, todayReservations],
  );

  // Todos os slots do dia + flag de cobertura
  const slots = useMemo(() => {
    return buildAllSlots(selectedDate).map(time => ({
      time,
      covering: coveringReservation(time, dayReservations),
    }));
  }, [selectedDate, dayReservations]);

  // Salas disponíveis no slot pendente (para oferecer reserva)
  const availableRoomsForPending = useMemo(() => {
    if (!pendingSlot) return [];
    return rooms.filter(r => r.isAvailable && isRoomFreeAtSlot(r, pendingSlot, todayReservations));
  }, [pendingSlot, rooms, todayReservations]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setPendingSlot(null);
  };

  const handleSlotPress = (slot: Date, covering: Reservation | undefined) => {
    if (covering) {
      // Slot coberto por reserva → seleciona diretamente
      setSelectedTime(slot);
      setPendingSlot(null);
    } else {
      // Slot sem reserva → mostra opção de contratar sala
      setSelectedTime(null);
      setPendingSlot(pendingSlot?.getTime() === slot.getTime() ? null : slot);
    }
  };

  const handleBookRoom = async (room: Room) => {
    if (!pendingSlot) return;

    // Regra: só reserva com saldo de horas (pacote pré-pago ou crédito de indicação).
    const professionalId = useAuthStore.getState().session?.user?.id;
    const temSaldo = professionalId ? await hasReservationCredit(professionalId) : false;
    if (!temSaldo) {
      Alert.alert(
        'Saldo de horas necessário',
        'Para reservar uma sala você precisa ter horas no seu saldo — compre um pacote de horas ou use o crédito recebido por indicação de um colega.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Comprar horas', onPress: () => { onClose(); router.push('/(tabs)/financeiro'); } },
        ],
      );
      return;
    }

    const endTime = new Date(pendingSlot.getTime() + selectedDuration * 60_000);
    const reservation: Reservation = {
      id:        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      roomName:  room.name,
      startTime: pendingSlot.toISOString(),
      endTime:   endTime.toISOString(),
      status:    'agendado',
    };
    addReservation(reservation);
    setSelectedTime(pendingSlot);
    setPendingSlot(null);
  };

  const canConfirm = selectedTime !== null;
  const endTime    = selectedTime ? new Date(selectedTime.getTime() + selectedDuration * 60_000) : null;
  const coveringForSelected = selectedTime ? coveringReservation(selectedTime, dayReservations) : undefined;

  const handleConfirm = () => {
    if (!canConfirm || !endTime) return;

    const dateStr  = `${WEEKDAY_SHORT[selectedDate.getDay()]}, ${selectedDate.getDate()} de ${MONTH_SHORT[selectedDate.getMonth()]}`;
    const timeStr  = `${formatHour(selectedTime!)} — ${formatHour(endTime)}`;
    const durLabel = DURATIONS.find(d => d.minutes === selectedDuration)?.label ?? `${selectedDuration}min`;
    const roomStr  = coveringForSelected ? `\nSala: ${coveringForSelected.roomName}` : '';

    Alert.alert(
      'Confirmar Encaixe',
      `${paciente.nome}\n${dateStr}\n${timeStr} (${durLabel})${roomStr}\n\nDeseja enviar o horário por WhatsApp ao paciente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Só confirmar', onPress: onConfirm },
        {
          text: 'Confirmar + WhatsApp',
          onPress: () => {
            // 1. Fecha somente EncaixeModal (parent PacienteDetail continua montado).
            // 2. Após animação de fechar, abre WhatsApp.
            // Isso evita o bug de iOS de Modal aninhado quando o app é
            // suspenso/restaurado pelo Linking.openURL.
            onConfirm();
            setTimeout(() => {
              notifyPatientEncaixe(
                paciente.nome,
                paciente.telefone,
                userName,
                dateStr,
                timeStr,
                durLabel,
                coveringForSelected?.roomName,
              ).catch(() => { /* WhatsApp pode estar indisponível */ });
            }, 300);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar encaixe">
          <Ionicons name="close" size={24} color={colors.oliDarkGray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sugerir Encaixe</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── Banner do paciente ── */}
      <View style={styles.patientBanner}>
        <View style={styles.patientAvatar}>
          <Text style={styles.patientAvatarText}>{paciente.nome.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.patientLabel}>Paciente</Text>
          <Text style={styles.patientName}>{paciente.nome}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Seleção de data ── */}
        <Text style={styles.sectionLabel}>DATA</Text>
        <View style={styles.datesRow}>
          {dates.map((d, i) => {
            const active  = d.toDateString() === selectedDate.toDateString();
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => handleDateSelect(d)}
                accessibilityLabel={`${isToday ? 'Hoje' : WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`}
              >
                <Text style={[styles.dateWeekday, active && styles.dateTextActive]}>
                  {isToday ? 'Hoje' : WEEKDAY_SHORT[d.getDay()]}
                </Text>
                <Text style={[styles.dateDay, active && styles.dateTextActive]}>{d.getDate()}</Text>
                <Text style={[styles.dateMonth, active && styles.dateTextActive]}>
                  {MONTH_SHORT[d.getMonth()]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Duração da consulta ── */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>DURAÇÃO DA CONSULTA</Text>
        <View style={styles.durationsRow}>
          {DURATIONS.map(d => {
            const active = selectedDuration === d.minutes;
            return (
              <TouchableOpacity
                key={d.minutes}
                style={[styles.durChip, active && styles.durChipActive]}
                onPress={() => setSelectedDuration(d.minutes)}
                accessibilityLabel={`Duração ${d.label}`}
              >
                <Text style={[styles.durText, active && styles.durTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Slots de horário ── */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>HORÁRIO</Text>

        {slots.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="time-outline" size={20} color={colors.oliLightGray} />
            <Text style={styles.emptyText}>Nenhum horário disponível hoje.</Text>
          </View>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map(({ time, covering }, i) => {
              const isCovered  = !!covering;
              const isSelected = selectedTime?.getTime() === time.getTime();
              const isPending  = pendingSlot?.getTime() === time.getTime();

              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.slotChip,
                    isCovered  && styles.slotChipCovered,
                    isSelected && styles.slotChipSelected,
                    isPending  && styles.slotChipPending,
                  ]}
                  onPress={() => handleSlotPress(time, covering)}
                  accessibilityLabel={
                    isCovered
                      ? `${formatHour(time)} — coberto por ${covering?.roomName}`
                      : `${formatHour(time)} — sem sala reservada, toque para contratar`
                  }
                >
                  <Text style={[
                    styles.slotTime,
                    isCovered  && styles.slotTimeCovered,
                    isSelected && styles.slotTimeSelected,
                    isPending  && styles.slotTimePending,
                  ]}>
                    {formatHour(time)}
                  </Text>
                  {isCovered && (
                    <Text style={[styles.slotRoom, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>
                      {covering?.roomName}
                    </Text>
                  )}
                  {!isCovered && (
                    <Ionicons
                      name="add-circle-outline"
                      size={12}
                      color={isPending ? colors.oliGold : colors.oliLightGray}
                      style={{ marginTop: 2 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Legenda ── */}
        {slots.length > 0 && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.oliGreen }]} />
              <Text style={styles.legendText}>Sala reservada</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.border, borderWidth: 1, borderColor: colors.oliLightGray }]} />
              <Text style={styles.legendText}>Sem reserva de sala</Text>
            </View>
          </View>
        )}

        {/* ── Painel: contratar sala ── */}
        {pendingSlot && (
          <View style={[styles.bookPanel, shadows.small]}>
            <View style={styles.bookPanelHeader}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.oliGold} />
              <Text style={styles.bookPanelTitle}>
                Sem sala reservada às {formatHour(pendingSlot)}
              </Text>
            </View>
            <Text style={styles.bookPanelSub}>
              Escolha uma sala disponível para reservar este horário:
            </Text>

            {availableRoomsForPending.length === 0 ? (
              <Text style={styles.bookPanelEmpty}>
                Nenhuma sala disponível neste horário.
              </Text>
            ) : (
              availableRoomsForPending.map(room => (
                <TouchableOpacity
                  key={room.id}
                  style={styles.roomOption}
                  onPress={() => handleBookRoom(room)}
                  accessibilityLabel={`Reservar ${room.name}`}
                >
                  <View style={styles.roomOptionLeft}>
                    <Text style={styles.roomOptionName}>{room.name}</Text>
                    <Text style={styles.roomOptionSpec}>{room.specialties.join(' · ')}</Text>
                  </View>
                  <View style={styles.roomOptionBtn}>
                    <Text style={styles.roomOptionBtnText}>Reservar</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ── Resumo ── */}
        {canConfirm && endTime && (
          <View style={[styles.summaryCard, shadows.small]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.oliGold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryText}>
                {WEEKDAY_SHORT[selectedDate.getDay()]}{', '}
                {selectedDate.getDate()} {MONTH_SHORT[selectedDate.getMonth()]}
                {'  ·  '}
                {formatHour(selectedTime!)} — {formatHour(endTime)}
                {'  ·  '}
                {DURATIONS.find(d => d.minutes === selectedDuration)?.label}
              </Text>
              {coveringForSelected && (
                <Text style={styles.summaryRoom}>{coveringForSelected.roomName}</Text>
              )}
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Rodapé ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          accessibilityLabel="Confirmar encaixe"
        >
          <Ionicons name="calendar-outline" size={20} color={colors.white} />
          <Text style={styles.confirmText}>Confirmar Encaixe</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oliBackground },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.oliDarkGray },

  patientBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    backgroundColor:   colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  patientAvatar: {
    width:           36, height: 36, borderRadius: 18,
    backgroundColor: `${colors.oliGreen}26`,
    justifyContent:  'center', alignItems: 'center',
  },
  patientAvatarText: { fontSize: 16, fontWeight: '700', color: colors.oliGreen },
  patientLabel:      { fontSize: 11, color: colors.gray },
  patientName:       { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },

  content: { padding: spacing.md, paddingBottom: 24, gap: spacing.sm },

  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         colors.gray,
    letterSpacing: 0.5,
    marginBottom:  spacing.xs,
  },

  // Datas
  datesRow:       { flexDirection: 'row', gap: spacing.sm },
  dateChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, ...shadows.small,
  },
  dateChipActive: { backgroundColor: colors.oliGreen, borderColor: colors.oliGreen },
  dateWeekday:    { fontSize: 10, fontWeight: '600', color: colors.gray },
  dateDay:        { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray, marginTop: 2 },
  dateMonth:      { fontSize: 10, color: colors.oliLightGray },
  dateTextActive: { color: colors.white },

  // Duração
  durationsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  durChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.white,
  },
  durChipActive: { backgroundColor: colors.oliGold, borderColor: colors.oliGold },
  durText:       { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  durTextActive: { color: colors.white },

  // Slots
  emptyWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  emptyText: { fontSize: 13, color: colors.oliLightGray },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  slotChip: {
    alignItems:        'center',
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
    minWidth:          72,
  },
  slotChipCovered:  { borderColor: colors.oliGreen, backgroundColor: `${colors.oliGreen}10` },
  slotChipSelected: { backgroundColor: colors.oliGreen, borderColor: colors.oliGreen },
  slotChipPending:  { borderColor: colors.oliGold, backgroundColor: `${colors.oliGold}12` },

  slotTime:       { fontSize: 14, fontWeight: '600', color: colors.oliLightGray },
  slotTimeCovered:{ color: colors.oliGreen },
  slotTimeSelected:{ color: colors.white },
  slotTimePending: { color: colors.oliGold },
  slotRoom:        { fontSize: 9, color: colors.oliGreen, fontWeight: '600', marginTop: 2 },

  // Legenda
  legend:     { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.gray },

  // Painel de reserva de sala
  bookPanel: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginTop:       spacing.sm,
    borderWidth:     1,
    borderColor:     `${colors.oliGold}40`,
  },
  bookPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  bookPanelTitle:  { fontSize: 14, fontWeight: '700', color: colors.oliDarkGray, flex: 1 },
  bookPanelSub:    { fontSize: 13, color: colors.gray, marginBottom: spacing.sm },
  bookPanelEmpty:  { fontSize: 13, color: colors.oliRed, textAlign: 'center', paddingVertical: spacing.sm },

  roomOption: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth:  0.5,
    borderTopColor:  colors.border,
  },
  roomOptionLeft:    { flex: 1 },
  roomOptionName:    { fontSize: 14, fontWeight: '700', color: colors.oliDarkGray },
  roomOptionSpec:    { fontSize: 11, color: colors.gray, marginTop: 2 },
  roomOptionBtn:     { backgroundColor: colors.oliGreen, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  roomOptionBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Resumo
  summaryCard: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.sm,
    backgroundColor: `${colors.oliGold}12`,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     `${colors.oliGold}30`,
    marginTop:       spacing.sm,
  },
  summaryText: { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray },
  summaryRoom: { fontSize: 12, color: colors.oliGreen, marginTop: 3, fontWeight: '500' },

  // Rodapé
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    backgroundColor:   colors.white,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
  },
  confirmBtn: {
    flexDirection:   'row', alignItems: 'center', justifyContent: 'center',
    gap:             spacing.sm, backgroundColor: colors.oliGold,
    borderRadius:    radius.md, paddingVertical: 14,
  },
  confirmBtnDisabled: { backgroundColor: colors.oliLightGray },
  confirmText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
