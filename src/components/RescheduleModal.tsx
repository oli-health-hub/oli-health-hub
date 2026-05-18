import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';
import { communicareService } from '../services/communicare';
import { colors, spacing, radius, shadows } from '../theme/designSystem';
import { formatHour, formatDate } from '../utils/formatters';
import type { Reservation } from '../models/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS     = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_SHORT   = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SLOT_MINUTES   = 30;
const BUFFER_MINUTES = 15;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  reservation: Reservation;
  onClose:     () => void;
  onConfirm:   () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the next 14 weekdays (Mon–Fri) starting from tomorrow */
function buildWeekdays(): Date[] {
  const result: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);

  while (result.length < 14) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/** Valid start times (30-min steps where at least 30 min is free). */
function buildStartSlots(
  date: Date,
  reservations: Reservation[],
  roomName: string,
  excludeId: string,
): Date[] {
  if (date.getDay() === 0 || date.getDay() === 6) return [];

  const slots: Date[] = [];
  const dayStart = new Date(date); dayStart.setHours(8, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(18, 30, 0, 0);

  let cursor = new Date(dayStart);
  while (cursor <= dayEnd) {
    const slotEnd = new Date(cursor.getTime() + SLOT_MINUTES * 60_000);
    const conflict = reservations.some(r => {
      if (r.id === excludeId || r.roomName !== roomName) return false;
      const rStart = new Date(r.startTime);
      const rEnd   = new Date(new Date(r.endTime).getTime() + BUFFER_MINUTES * 60_000);
      return cursor < rEnd && slotEnd > rStart;
    });
    if (!conflict) slots.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + SLOT_MINUTES * 60_000);
  }
  return slots;
}

/**
 * Valid end times after a chosen start.
 * Stops as soon as a conflict is hit (can't skip a blocked slot).
 */
function buildEndSlots(
  startTime: Date,
  date: Date,
  reservations: Reservation[],
  roomName: string,
  excludeId: string,
): Date[] {
  const endSlots: Date[] = [];
  const dayEnd = new Date(date); dayEnd.setHours(19, 0, 0, 0);

  let cursor = new Date(startTime.getTime() + SLOT_MINUTES * 60_000);
  while (cursor <= dayEnd) {
    const conflict = reservations.some(r => {
      if (r.id === excludeId || r.roomName !== roomName) return false;
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

// ─── Component ────────────────────────────────────────────────────────────────

export function RescheduleModal({ reservation, onClose, onConfirm }: Props) {
  const {
    rooms,
    todayReservations,
    rescheduleReservation,
  } = useAppStore();

  const weekdays = useMemo(buildWeekdays, []);

  const [selectedDayIdx,   setSelectedDayIdx]   = useState(0);
  const [selectedRoomName, setSelectedRoomName]  = useState(reservation.roomName);
  const [selectedStart,    setSelectedStart]     = useState<Date | null>(null);
  const [selectedEnd,      setSelectedEnd]       = useState<Date | null>(null);

  const selectedDate = weekdays[selectedDayIdx];

  const eligibleRooms = useMemo(
    () => rooms.filter(r => r.isAvailable || r.name === reservation.roomName),
    [rooms, reservation.roomName],
  );

  const startSlots = useMemo(
    () => buildStartSlots(selectedDate, todayReservations, selectedRoomName, reservation.id),
    [selectedDate, todayReservations, selectedRoomName, reservation.id],
  );

  const endSlots = useMemo(
    () => selectedStart
      ? buildEndSlots(selectedStart, selectedDate, todayReservations, selectedRoomName, reservation.id)
      : [],
    [selectedStart, selectedDate, todayReservations, selectedRoomName, reservation.id],
  );

  const handleDaySelect = (idx: number) => {
    setSelectedDayIdx(idx);
    setSelectedStart(null);
    setSelectedEnd(null);
  };

  const handleRoomSelect = (name: string) => {
    setSelectedRoomName(name);
    setSelectedStart(null);
    setSelectedEnd(null);
  };

  const handleSelectStart = (slot: Date) => {
    setSelectedStart(slot);
    setSelectedEnd(null);
  };

  const canConfirm = selectedStart !== null && selectedEnd !== null;

  const handleConfirm = async () => {
    if (!canConfirm) return;

    rescheduleReservation(reservation.id, selectedStart!, selectedEnd!);

    const selectedRoom = rooms.find(r => r.name === selectedRoomName);
    if (selectedRoom) {
      (async () => {
        try {
          await communicareService.cancelReservation(reservation.id);
          await communicareService.createReservation({
            roomId:         selectedRoom.id,
            professionalId: 'prof-mock-001',
            startTime:      selectedStart!,
            endTime:        selectedEnd!,
          });
        } catch {
          // Silent — local state already updated
        }
      })();
    }

    onConfirm();
  };

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reagendar Consulta</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar reagendamento">
          <Ionicons name="close" size={24} color={colors.oliDarkGray} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Reserva atual ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>RESERVA ATUAL</Text>
        </View>
        <View style={[styles.currentCard, shadows.small]}>
          <View style={styles.currentCardInner}>
            <Text style={styles.currentRoom}>{reservation.roomName}</Text>
            <Text style={styles.currentTime}>
              {formatDate(reservation.startTime)} · {formatHour(reservation.startTime)} — {formatHour(reservation.endTime)}
            </Text>
          </View>
        </View>

        {/* ── Seleção de data ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>NOVA DATA</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateStrip}
          contentContainerStyle={styles.dateStripContent}
        >
          {weekdays.map((day, i) => {
            const isActive = i === selectedDayIdx;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.datePill, isActive && styles.datePillActive]}
                onPress={() => handleDaySelect(i)}
                accessibilityLabel={`${DAY_LABELS[day.getDay()]} ${day.getDate()} de ${MONTHS_SHORT[day.getMonth()]}`}
              >
                <Text style={[styles.datePillDay,  isActive && styles.datePillTextActive]}>
                  {DAY_LABELS[day.getDay()]}
                </Text>
                <Text style={[styles.datePillNum,  isActive && styles.datePillTextActive]}>
                  {day.getDate()}
                </Text>
                <Text style={[styles.datePillMonth, isActive && styles.datePillTextActive]}>
                  {MONTHS_SHORT[day.getMonth()]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Seleção de sala ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>SALA</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.roomStrip}
          contentContainerStyle={styles.roomStripContent}
        >
          {eligibleRooms.map(room => {
            const isActive = room.name === selectedRoomName;
            return (
              <TouchableOpacity
                key={room.id}
                style={[styles.roomChip, isActive && styles.roomChipActive]}
                onPress={() => handleRoomSelect(room.name)}
                accessibilityLabel={`Selecionar ${room.name}`}
              >
                <Text style={[styles.roomChipText, isActive && styles.roomChipTextActive]}>
                  {room.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Horário de início ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>INÍCIO</Text>
        </View>
        {startSlots.length === 0 ? (
          <View style={[styles.card, shadows.small]}>
            <Text style={styles.noSlots}>Nenhum horário disponível para esta sala e data.</Text>
          </View>
        ) : (
          <View style={[styles.card, shadows.small]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsRow}>
              {startSlots.map((slot, i) => {
                const isActive = selectedStart?.getTime() === slot.getTime();
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.slotChip, isActive && styles.slotChipActive]}
                    onPress={() => handleSelectStart(slot)}
                    accessibilityLabel={`Início às ${formatHour(slot)}`}
                  >
                    <Text style={[styles.slotText, isActive && styles.slotTextActive]}>
                      {formatHour(slot)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Horário de fim ── */}
        {selectedStart && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>FIM · mínimo 30 min</Text>
            </View>
            {endSlots.length === 0 ? (
              <View style={[styles.card, shadows.small]}>
                <Text style={styles.noSlots}>Nenhum horário de fim disponível.</Text>
              </View>
            ) : (
              <View style={[styles.card, shadows.small]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsRow}>
                  {endSlots.map((slot, i) => {
                    const isActive = selectedEnd?.getTime() === slot.getTime();
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.slotChip, isActive && styles.slotChipActive]}
                        onPress={() => setSelectedEnd(slot)}
                        accessibilityLabel={`Fim às ${formatHour(slot)}`}
                      >
                        <Text style={[styles.slotText, isActive && styles.slotTextActive]}>
                          {formatHour(slot)}
                        </Text>
                        <Text style={[styles.slotDuration, isActive && styles.slotTextActive]}>
                          {durationLabel(selectedStart, slot)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* ── Resumo ── */}
        {canConfirm && (
          <View style={[styles.summaryCard, shadows.small]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.white} />
            <Text style={styles.summaryText}>
              {selectedRoomName} · {formatDate(selectedDate)} · {formatHour(selectedStart!)} — {formatHour(selectedEnd!)} · {durationLabel(selectedStart!, selectedEnd!)}
            </Text>
          </View>
        )}

        {/* ── Confirmar ── */}
        <TouchableOpacity
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          accessibilityLabel="Confirmar reagendamento"
        >
          <Text style={styles.confirmText}>Confirmar Reagendamento</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.oliBackground },

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

  scroll:        { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },

  sectionLabel: { marginBottom: spacing.xs, marginTop: spacing.sm },
  sectionLabelText: {
    fontSize:    11,
    fontWeight:  '700',
    color:       colors.gray,
    letterSpacing: 0.5,
  },

  // Current reservation card
  currentCard: {
    backgroundColor: `${colors.oliGold}1A`,
    borderRadius:    radius.md,
    marginBottom:    spacing.md,
    padding:         spacing.md,
  },
  currentCardInner: { gap: 2 },
  currentRoom:    { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },
  currentTime:    { fontSize: 14, color: colors.oliLightGray },
  currentPatient: { fontSize: 13, color: colors.oliGold, fontWeight: '500', marginTop: 2 },

  // Date strip
  dateStrip:        { marginBottom: spacing.md },
  dateStripContent: { gap: spacing.sm, paddingRight: spacing.md },
  datePill: {
    alignItems:      'center',
    paddingVertical:  spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:    radius.full,
    borderWidth:     1,
    borderColor:     colors.border,
    backgroundColor: colors.white,
    minWidth:        56,
  },
  datePillActive:    { backgroundColor: colors.oliGreen, borderColor: colors.oliGreen },
  datePillDay:       { fontSize: 10, fontWeight: '600', color: colors.oliLightGray },
  datePillNum:       { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  datePillMonth:     { fontSize: 10, fontWeight: '500', color: colors.oliLightGray },
  datePillTextActive:{ color: colors.white },

  // Room strip
  roomStrip:        { marginBottom: spacing.md },
  roomStripContent: { gap: spacing.sm, paddingRight: spacing.md },
  roomChip: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.oliGreen,
    backgroundColor:   colors.white,
  },
  roomChipActive:    { backgroundColor: colors.oliGreen },
  roomChipText:      { fontSize: 13, fontWeight: '500', color: colors.oliGreen },
  roomChipTextActive:{ color: colors.white },

  // Slot card
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginBottom:    spacing.md,
  },
  noSlots:  { fontSize: 14, color: colors.oliRed, textAlign: 'center', paddingVertical: spacing.sm },
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

  // Summary card
  summaryCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginBottom:    spacing.md,
  },
  summaryText: { fontSize: 14, fontWeight: '600', color: colors.white, flex: 1 },

  // Confirm button
  confirmButton: {
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'center',
  },
  confirmButtonDisabled: { backgroundColor: colors.oliLightGray },
  confirmText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
