import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Calendar from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { hasReservationCredit } from '../services/financeiroService';
import { isRoomConflictError } from '../services/reservationService';
import { colors, spacing, radius, shadows } from '../theme/designSystem';
import { formatHour, formatDate } from '../utils/formatters';
import { useAndroidBack } from '../hooks/useAndroidBack';
import type { Room, Reservation } from '../models/types';

interface Props {
  room:               Room;
  selectedDate:       Date;          // data inicial sugerida (informativa)
  isCalendarGranted:  boolean;
  onReserve:          () => void;
  onClose:            () => void;
}

const SLOT_MINUTES   = 30;
const BUFFER_MINUTES = 15;
const DAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Geração de slots ─────────────────────────────────────────────────────────

function buildStartSlots(date: Date, reservations: Reservation[], roomName: string): Date[] {
  if (date.getDay() === 0) return [];

  const slots: Date[] = [];
  const dayStart = new Date(date); dayStart.setHours(8, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(18, 30, 0, 0);

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  let cursor: Date;
  if (isToday) {
    const nextSlot = new Date(Math.ceil(now.getTime() / (SLOT_MINUTES * 60_000)) * (SLOT_MINUTES * 60_000));
    cursor = nextSlot > dayStart ? nextSlot : new Date(dayStart);
  } else {
    cursor = new Date(dayStart);
  }

  while (cursor <= dayEnd) {
    const slotEnd = new Date(cursor.getTime() + SLOT_MINUTES * 60_000);
    const conflict = reservations.some(r => {
      if (r.roomName !== roomName) return false;
      const rStart = new Date(r.startTime);
      const rEnd   = new Date(new Date(r.endTime).getTime() + BUFFER_MINUTES * 60_000);
      return cursor < rEnd && slotEnd > rStart;
    });
    if (!conflict) slots.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + SLOT_MINUTES * 60_000);
  }
  return slots;
}

function buildEndSlots(startTime: Date, date: Date, reservations: Reservation[], roomName: string): Date[] {
  const endSlots: Date[] = [];
  const dayEnd = new Date(date); dayEnd.setHours(19, 0, 0, 0);
  let cursor = new Date(startTime.getTime() + SLOT_MINUTES * 60_000);

  while (cursor <= dayEnd) {
    const conflict = reservations.some(r => {
      if (r.roomName !== roomName) return false;
      const rStart = new Date(r.startTime);
      const rEnd   = new Date(new Date(r.endTime).getTime() + BUFFER_MINUTES * 60_000);
      return startTime < rEnd && cursor > rStart;
    });
    if (conflict) break;
    endSlots.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + SLOT_MINUTES * 60_000);
  }
  return endSlots;
}

function durationLabel(start: Date, end: Date): string {
  const mins = (end.getTime() - start.getTime()) / 60_000;
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

// ─── Seletor de dia (strip de 14 dias) ───────────────────────────────────────

function DayStrip({
  selected,
  reservedDates,
  onSelect,
}: {
  selected: Date;
  reservedDates: Set<string>;
  onSelect: (d: Date) => void;
}) {
  const today = new Date();

  // 14 dias a partir de hoje
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const pad = (n: number) => String(n).padStart(2, '0');
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStripScroll}>
      {days.map(d => {
        const key        = toKey(d);
        const isSelected = toKey(selected) === key;
        const isToday    = toKey(d) === toKey(today);
        const isWeekend  = d.getDay() === 0;
        const hasReserv  = reservedDates.has(key);

        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.dayCell,
              isSelected && styles.dayCellSelected,
              isWeekend && !isSelected && styles.dayCellWeekend,
            ]}
            onPress={() => onSelect(d)}
            accessibilityLabel={`${DAY_LABELS_SHORT[d.getDay()]} ${d.getDate()}`}
          >
            <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected, isWeekend && !isSelected && styles.dayLabelWeekend]}>
              {DAY_LABELS_SHORT[d.getDay()]}
            </Text>
            <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isToday && !isSelected && styles.dayNumToday, isWeekend && !isSelected && styles.dayLabelWeekend]}>
              {d.getDate()}
            </Text>
            {hasReserv && (
              <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReservationModal({
  room, selectedDate: initialDate, isCalendarGranted, onReserve, onClose,
}: Props) {
  useAndroidBack(onClose);
  const { addReservation, upcomingReservations, roomOccupancy } = useAppStore();
  const router = useRouter();

  // O dia é selecionado dentro do modal — começa com o dia sugerido pela agenda
  const [pickedDate,    setPickedDate]    = useState<Date>(() => {
    const d = new Date(initialDate);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd,   setSelectedEnd]   = useState<Date | null>(null);
  const [loading,       setLoading]       = useState(false);

  const handlePickDate = (d: Date) => {
    setPickedDate(d);
    setSelectedStart(null);
    setSelectedEnd(null);
  };

  // Datas com reservas para marcar pontinhos no strip
  const pad = (n: number) => String(n).padStart(2, '0');
  const reservedDates = useMemo(() => new Set<string>(
    upcomingReservations.map(r => r.startTime.slice(0, 10)),
  ), [upcomingReservations]);

  const startSlots = useMemo(
    () => buildStartSlots(pickedDate, roomOccupancy, room.name),
    [pickedDate, roomOccupancy, room.name],
  );

  const endSlots = useMemo(
    () => selectedStart
      ? buildEndSlots(selectedStart, pickedDate, roomOccupancy, room.name)
      : [],
    [selectedStart, pickedDate, roomOccupancy, room.name],
  );

  const handleSelectStart = (slot: Date) => {
    setSelectedStart(slot);
    setSelectedEnd(null);
  };

  const canConfirm = selectedStart !== null && selectedEnd !== null;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setLoading(true);

    try {
      // Regra: só reserva com saldo de horas (pacote pré-pago ou crédito de indicação).
      const professionalId = useAuthStore.getState().session?.user?.id;
      const temSaldo = professionalId ? await hasReservationCredit(professionalId) : false;
      if (!temSaldo) {
        setLoading(false);
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

      const reservation: Reservation = {
        id:        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        roomName:  room.name,
        startTime: selectedStart!.toISOString(),
        endTime:   selectedEnd!.toISOString(),
      };

      await addReservation(reservation);

      if (isCalendarGranted) {
        await saveToCalendar(selectedStart!, selectedEnd!);
      }

      onReserve();
    } catch (err) {
      if (isRoomConflictError(err)) {
        Alert.alert('Sala já reservada', 'Outro profissional reservou essa sala nesse horário. Escolha outro horário.');
      } else {
        Alert.alert('Erro', 'Não foi possível confirmar a reserva. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveToCalendar = async (start: Date, end: Date) => {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCal = calendars.find(c => c.allowsModifications) ?? calendars[0];
      if (!defaultCal) return;
      await Calendar.createEventAsync(defaultCal.id, {
        title:    `Reserva OLI — ${room.name}`,
        startDate: start,
        endDate:   end,
        notes:    'Reserva feita pelo app OLI Health Hub',
      });
    } catch {
      // Calendário é opcional — não bloqueia a reserva
    }
  };

  const isWeekend = pickedDate.getDay() === 0;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nova Reserva</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cancelar reserva">
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Sala */}
        <View style={[styles.card, shadows.small]}>
          <Text style={styles.sectionLabel}>SALA</Text>
          <Text style={styles.roomName}>{room.name}</Text>
          <Text style={styles.roomSpecialties}>{room.specialties.join(' • ')}</Text>
        </View>

        {/* Seleção de dia */}
        <View style={[styles.card, shadows.small]}>
          <Text style={styles.sectionLabel}>DIA</Text>
          <DayStrip
            selected={pickedDate}
            reservedDates={reservedDates}
            onSelect={handlePickDate}
          />
          <Text style={styles.pickedDateLabel}>{formatDate(pickedDate)}</Text>
        </View>

        {/* Horário de início */}
        <View style={[styles.card, shadows.small]}>
          <Text style={styles.sectionLabel}>INÍCIO</Text>
          {isWeekend || startSlots.length === 0 ? (
            <Text style={styles.noSlots}>
              {isWeekend
                ? 'Sem atendimento aos domingos.'
                : 'Nenhum horário disponível para este dia.'}
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsRow}>
              {startSlots.map((slot, i) => {
                const active = selectedStart?.getTime() === slot.getTime();
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.slotChip, active && styles.slotChipActive]}
                    onPress={() => handleSelectStart(slot)}
                    accessibilityLabel={`Início às ${formatHour(slot)}`}
                  >
                    <Text style={[styles.slotText, active && styles.slotTextActive]}>
                      {formatHour(slot)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Horário de fim */}
        {selectedStart && (
          <View style={[styles.card, shadows.small]}>
            <Text style={styles.sectionLabel}>FIM · mínimo 30 min</Text>
            {endSlots.length === 0 ? (
              <Text style={styles.noSlots}>Nenhum horário de fim disponível.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsRow}>
                {endSlots.map((slot, i) => {
                  const active = selectedEnd?.getTime() === slot.getTime();
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.slotChip, active && styles.slotChipActive]}
                      onPress={() => setSelectedEnd(slot)}
                      accessibilityLabel={`Fim às ${formatHour(slot)}`}
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive]}>
                        {formatHour(slot)}
                      </Text>
                      <Text style={[styles.slotDuration, active && styles.slotTextActive]}>
                        {durationLabel(selectedStart, slot)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* Resumo */}
        {canConfirm && (
          <View style={[styles.summaryCard, shadows.small]}>
            <Text style={styles.summaryText}>
              {formatDate(pickedDate)}{'  '}
              {formatHour(selectedStart!)} — {formatHour(selectedEnd!)}{'  '}·{'  '}
              {durationLabel(selectedStart!, selectedEnd!)}
            </Text>
          </View>
        )}

        {/* Confirmar */}
        <TouchableOpacity
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm || loading}
          accessibilityLabel="Confirmar reserva"
        >
          <Text style={styles.confirmText}>{loading ? 'Confirmando...' : 'Confirmar Reserva'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.oliBackground },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    padding:           spacing.md,
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  cancelText:  { fontSize: 16, color: colors.oliGreen },
  scroll:      { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  sectionLabel:    { fontSize: 11, fontWeight: '700', color: colors.gray, marginBottom: spacing.sm, letterSpacing: 0.5 },
  roomName:        { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray },
  roomSpecialties: { fontSize: 13, color: colors.gray, marginTop: 4 },

  // ── Day strip ──
  dayStripScroll: { flexDirection: 'row' },
  dayCell: {
    alignItems:      'center',
    paddingHorizontal: 10,
    paddingVertical:  8,
    borderRadius:    radius.md,
    marginRight:     spacing.xs,
    minWidth:        48,
    backgroundColor: colors.oliBackground,
  },
  dayCellSelected: { backgroundColor: colors.oliGreen },
  dayCellWeekend:  { opacity: 0.45 },
  dayLabel: { fontSize: 11, fontWeight: '600', color: colors.gray, marginBottom: 2 },
  dayLabelSelected: { color: colors.white },
  dayLabelWeekend:  { color: colors.oliLightGray },
  dayNum:  { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  dayNumSelected: { color: colors.white },
  dayNumToday:    { color: colors.oliGreen },
  dayDot: {
    width: 5, height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.oliGreen,
    marginTop: 3,
  },
  dayDotSelected: { backgroundColor: colors.white },
  pickedDateLabel: {
    marginTop:  spacing.sm,
    fontSize:   13,
    fontWeight: '600',
    color:      colors.oliDarkGray,
    textAlign:  'center',
  },

  noSlots: { fontSize: 14, color: colors.oliRed, textAlign: 'center', paddingVertical: spacing.sm },

  slotsRow: { flexDirection: 'row' },
  slotChip: {
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.oliGreen,
    marginRight:       spacing.sm,
    backgroundColor:   colors.white,
    minWidth:          64,
  },
  slotChipActive:  { backgroundColor: colors.oliGreen },
  slotText:        { fontSize: 14, fontWeight: '600', color: colors.oliGreen },
  slotTextActive:  { color: colors.white },
  slotDuration:    { fontSize: 10, color: colors.oliLightGray, marginTop: 1 },

  summaryCard: {
    backgroundColor: `${colors.oliGreen}12`,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     `${colors.oliGreen}30`,
  },
  summaryText: { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray, textAlign: 'center' },

  confirmButton: {
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'center',
  },
  confirmButtonDisabled: { backgroundColor: colors.oliLightGray },
  confirmText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
