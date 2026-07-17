import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Calendar from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/appStore';
import { communicareService } from '../../src/services/communicare';
import { ReservationModal } from '../../src/components/ReservationModal';
import { RescheduleModal } from '../../src/components/RescheduleModal';
import { RoomDetailModal } from '../../src/components/RoomDetailModal';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import { formatHour } from '../../src/utils/formatters';
import { getRoomCover, getRoomPhotos } from '../../src/utils/roomPhotos';
import {
  buildDaySegments, nextFreeLabel,
  DAY_START_MIN, DAY_TOTAL_MIN, HOUR_MARKS,
} from '../../src/utils/roomTimeline';
import type { Room, Reservation } from '../../src/models/types';

// ─── Política de cancelamento ─────────────────────────────────────────────────

function cancellationPolicy(startTimeIso: string): {
  label: string;
  color: string;
  feeDescription: string;
} {
  const hoursUntil = (new Date(startTimeIso).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil >= 24) return {
    label:          'Cancelamento gratuito até 24h antes',
    color:          colors.oliGreen,
    feeDescription: 'Sem cobrança.',
  };
  if (hoursUntil >= 12) return {
    label:          'Cancelamento com 50% de multa (entre 12h e 24h)',
    color:          colors.oliGold,
    feeDescription: '50% do valor da locação será cobrado.',
  };
  return {
    label:          'Cancelamento com cobrança integral (< 12h)',
    color:          colors.oliRed,
    feeDescription: '100% do valor da locação será cobrado.',
  };
}

const SPECIALTIES = [
  'Todas', 'Clínica Geral', 'Psicologia',
  'Ginecologia', 'Estética', 'Vídeo Conferência', 'Audio Visual', 'Eventos',
];

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── Calendário Mensal ────────────────────────────────────────────────────────

function MonthCalendar({
  selectedDate,
  onSelectDate,
  reservedDates,
}: {
  selectedDate:  Date;
  onSelectDate:  (date: Date) => void;
  reservedDates: Set<string>;
}) {
  const [viewYear,  setViewYear]  = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const today = new Date();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDay   = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Células: null = padding vazio, número = dia
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Dividir em linhas de 7
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const sameDay = (d: Date, y: number, m: number, day: number) =>
    d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;

  const toKey = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <View>
      {/* Navegação */}
      <View style={calStyles.nav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={8} accessibilityLabel="Mês anterior">
          <Ionicons name="chevron-back" size={22} color={colors.oliDarkGray} />
        </TouchableOpacity>
        <Text style={calStyles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={8} accessibilityLabel="Próximo mês">
          <Ionicons name="chevron-forward" size={22} color={colors.oliDarkGray} />
        </TouchableOpacity>
      </View>

      {/* Cabeçalho dias */}
      <View style={calStyles.weekRow}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={[calStyles.weekLabel, (d === 'Dom' || d === 'Sáb') && calStyles.weekLabelWeekend]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Linhas de dias */}
      {rows.map((row, ri) => (
        <View key={ri} style={calStyles.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={`e${ci}`} style={calStyles.cell} />;

            const isSelected = sameDay(selectedDate, viewYear, viewMonth, day);
            const isToday    = sameDay(today, viewYear, viewMonth, day);
            const isWeekend  = ci === 0 || ci === 6;
            const hasReserv  = reservedDates.has(toKey(day));
            const isPast     = new Date(viewYear, viewMonth, day) <
              new Date(today.getFullYear(), today.getMonth(), today.getDate());

            return (
              <TouchableOpacity
                key={day}
                style={calStyles.cell}
                onPress={() => onSelectDate(new Date(viewYear, viewMonth, day))}
                disabled={isPast}
                accessibilityLabel={`${day} de ${MONTHS[viewMonth]}`}
              >
                <View style={[
                  calStyles.dayCircle,
                  isSelected && calStyles.dayCircleSelected,
                  isToday && !isSelected && calStyles.dayCircleToday,
                ]}>
                  <Text style={[
                    calStyles.dayNum,
                    isSelected              && calStyles.dayNumSelected,
                    isToday && !isSelected  && calStyles.dayNumToday,
                    isWeekend && !isSelected && calStyles.dayNumWeekend,
                    isPast                  && calStyles.dayNumPast,
                  ]}>
                    {day}
                  </Text>
                </View>
                {hasReserv && (
                  <View style={[calStyles.dot, isSelected && calStyles.dotSelected]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AgendaScreen() {
  const {
    rooms, upcomingReservations,
    cancelReservation,
  } = useAppStore();

  const [selectedDate,      setSelectedDate]      = useState(new Date());
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todas');
  const [selectedRoom,      setSelectedRoom]      = useState<Room | null>(null);
  const [showDetailModal,   setShowDetailModal]   = useState(false);
  const [showModal,         setShowModal]         = useState(false);
  const [calendarGranted,   setCalendarGranted]   = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Reservation | null>(null);

  const filteredRooms  = selectedSpecialty === 'Todas'
    ? rooms
    : rooms.filter(r => r.specialties.includes(selectedSpecialty));
  const availableCount = filteredRooms.filter(r => r.isAvailable).length;

  // Datas com reservas (para marcar pontos no calendário)
  const reservedDates = new Set<string>(
    upcomingReservations.map(r => r.startTime.slice(0, 10)),
  );

  // Reservas do dia selecionado
  const pad = (n: number) => String(n).padStart(2, '0');
  const selectedDateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`;
  const dayReservations = upcomingReservations.filter(r => r.startTime.startsWith(selectedDateStr));

  useEffect(() => {
    (async () => {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      setCalendarGranted(status === 'granted');
    })();
  }, []);

  const requestCalendar = async () => {
    if (calendarGranted) return;
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
      setCalendarGranted(true);
    } else {
      Alert.alert('Permissão negada', 'Ative o acesso à agenda em Ajustes > OLI Health Hub > Calendário.');
    }
  };

  const handleRoomPress = (room: Room) => {
    setSelectedRoom(room);
    setShowDetailModal(true);
  };

  const handleReserved = () => {
    setShowModal(false);
    Alert.alert('Reserva Confirmada', 'Sua reserva foi registrada com sucesso.');
  };

  const handleReservationOptions = (res: Reservation) => {
    const policy = cancellationPolicy(res.startTime);
    Alert.alert(
      res.roomName,
      `${formatHour(res.startTime)} — ${formatHour(res.endTime)}\n\n${policy.feeDescription}`,
      [
        {
          text: 'Reagendar',
          onPress: () => setRescheduleTarget(res),
        },
        {
          text: 'Cancelar reserva',
          style: 'destructive',
          onPress: async () => {
            cancelReservation(res.id);
            try { await communicareService.cancelReservation(res.id); } catch { /* silencioso */ }
          },
        },
        { text: 'Fechar', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Agenda e Salas</Text>
        </View>

        {/* ── Calendário Mensal ── */}
        <View style={[styles.calendarCard, shadows.card]}>
          {/* Chip de sincronização: botão p/ conectar OU badge "Sincronizado" */}
          <View style={styles.syncChipRow}>
            {calendarGranted ? (
              <View style={[styles.syncChip, styles.syncChipDone]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.oliGreen} />
                <Text style={styles.syncChipDoneText}>Agenda sincronizada</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.syncChip}
                onPress={requestCalendar}
                accessibilityLabel="Sincronizar com a agenda do celular"
              >
                <Ionicons name="sync-outline" size={14} color={colors.white} />
                <Text style={styles.syncChipText}>Sincronizar agenda</Text>
              </TouchableOpacity>
            )}
          </View>

          <MonthCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            reservedDates={reservedDates}
          />
        </View>

        {/* ── Data selecionada ── */}
        <View style={styles.selectedDateRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.oliGreen} />
          <Text style={styles.selectedDateText}>
            {selectedDate.toLocaleDateString('pt-BR', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </Text>
        </View>

        {/* ── Minhas Reservas ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Minhas Reservas</Text>
          {dayReservations.length > 0 && (
            <View style={styles.availableBadge}>
              <Text style={styles.availableText}>
                {dayReservations.length} {dayReservations.length === 1 ? 'reserva' : 'reservas'}
              </Text>
            </View>
          )}
        </View>

        {dayReservations.length === 0 ? (
          <View style={styles.emptyReservations}>
            <Ionicons name="calendar-outline" size={32} color={colors.oliLightGray} />
            <Text style={styles.emptyReservationsText}>
              Nenhuma reserva para este dia
            </Text>
            <Text style={styles.emptyReservationsSub}>
              Toque em uma sala abaixo para reservar
            </Text>
          </View>
        ) : (
          dayReservations.map(res => {
            const policy = cancellationPolicy(res.startTime);
            return (
              <View key={res.id} style={[styles.reservationCard, shadows.small]}>
                <View style={styles.resAccent} />
                <View style={styles.resBody}>
                  <View style={styles.resTopRow}>
                    <Text style={styles.resTime}>
                      {formatHour(res.startTime)} — {formatHour(res.endTime)}
                    </Text>
                    <Text style={styles.resRoom}>{res.roomName}</Text>
                  </View>
                  <View style={styles.resPolicyRow}>
                    <Ionicons name="information-circle-outline" size={12} color={policy.color} />
                    <Text style={[styles.resPolicyText, { color: policy.color }]}>
                      {policy.label}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.resMenuBtn}
                  onPress={() => handleReservationOptions(res)}
                  accessibilityLabel={`Opções da reserva das ${formatHour(res.startTime)}`}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.oliLightGray} />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* ── Filtro de especialidades ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {SPECIALTIES.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, s === selectedSpecialty && styles.filterChipActive]}
              onPress={() => setSelectedSpecialty(s)}
              accessibilityLabel={`Filtrar por ${s}`}
            >
              <Text style={[styles.filterText, s === selectedSpecialty && styles.filterTextActive]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Título + contador ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Salas Disponíveis</Text>
          <View style={styles.availableBadge}>
            <Text style={styles.availableText}>{availableCount} livres</Text>
          </View>
        </View>

        {/* ── Grid de salas (2 colunas) ── */}
        <View style={styles.grid}>
          {filteredRooms.map(room => {
            const segs     = buildDaySegments(selectedDate, upcomingReservations, room.name);
            const freeText = room.isAvailable ? nextFreeLabel(segs, selectedDate) : 'Ocupada';
            const freeColor = freeText === 'Sem horários livres' || !room.isAvailable
              ? colors.oliLightGray
              : colors.oliGreen;

            return (
              <TouchableOpacity
                key={room.id}
                style={[styles.roomCard, shadows.small, !room.isAvailable && styles.roomCardOccupied]}
                onPress={() => handleRoomPress(room)}
                accessibilityLabel={`${room.name} — ${room.isAvailable ? 'disponível' : 'ocupada'}, toque para ver detalhes`}
              >
                {/* Foto da sala (banner) */}
                {getRoomCover(room.id) && (
                  <View style={styles.roomCoverWrap}>
                    <Image
                      source={getRoomCover(room.id)}
                      style={styles.roomCover}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                    {getRoomPhotos(room.id).length > 1 && (
                      <View style={styles.photoCountBadge}>
                        <Ionicons name="images-outline" size={11} color={colors.white} />
                        <Text style={styles.photoCountText}>{getRoomPhotos(room.id).length}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Topo: ícone + dot de status */}
                <View style={styles.roomCardTop}>
                  <Ionicons
                    name="open-outline"
                    size={20}
                    color={room.isAvailable ? colors.oliGreen : colors.oliLightGray}
                  />
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: room.isAvailable ? colors.oliGreen : colors.oliRed },
                  ]} />
                </View>

                {/* Nome e especialidade */}
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomSpec} numberOfLines={1}>
                  {room.specialties.join(', ')}
                </Text>

                {/* Mini-timeline */}
                <View style={styles.miniTimelineWrap}>
                  <View style={styles.miniTimelineBar}>
                    {segs.map((seg, i) => (
                      <View
                        key={i}
                        style={[
                          styles.miniSeg,
                          { flex: seg.endMin - seg.startMin },
                          seg.type === 'free'
                            ? styles.miniSegFree
                            : styles.miniSegOccupied,
                          i === 0                 && { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
                          i === segs.length - 1   && { borderTopRightRadius: 3, borderBottomRightRadius: 3 },
                        ]}
                      />
                    ))}
                  </View>
                  {/* Eixo: 08h e 19h */}
                  <View style={styles.miniAxisRow}>
                    <Text style={styles.miniAxisLabel}>8h</Text>
                    <Text style={styles.miniAxisLabel}>19h</Text>
                  </View>
                </View>

                {/* Texto de disponibilidade */}
                <Text style={[styles.roomFreeText, { color: freeColor }]} numberOfLines={1}>
                  {room.occupiedBy ? room.occupiedBy : freeText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>


      </ScrollView>

      {/* ── Modal: Reagendar ── */}
      <Modal visible={!!rescheduleTarget} animationType="slide" presentationStyle="pageSheet">
        {rescheduleTarget && (
          <RescheduleModal
            reservation={rescheduleTarget}
            onClose={() => setRescheduleTarget(null)}
            onConfirm={() => {
              setRescheduleTarget(null);
              Alert.alert('Reagendado', 'Reserva atualizada com sucesso.');
            }}
          />
        )}
      </Modal>

      {/* ── Modal: Detalhes da sala ── */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        {selectedRoom && (
          <RoomDetailModal
            room={selectedRoom}
            selectedDate={selectedDate}
            reservations={upcomingReservations}
            onClose={() => setShowDetailModal(false)}
            onReserve={() => {
              setShowDetailModal(false);
              setShowModal(true);
            }}
          />
        )}
      </Modal>

      {/* ── Modal: Reserva ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        {selectedRoom && (
          <ReservationModal
            room={selectedRoom}
            selectedDate={selectedDate}
            isCalendarGranted={calendarGranted}
            onReserve={handleReserved}
            onClose={() => setShowModal(false)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles do calendário ─────────────────────────────────────────────────────

const CELL_SIZE = 36;

const calStyles = StyleSheet.create({
  nav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthTitle: { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },

  weekRow:          { flexDirection: 'row', marginBottom: 4 },
  weekLabel:        { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.gray, paddingVertical: 4 },
  weekLabelWeekend: { color: `${colors.gray}60` },

  row:  { flexDirection: 'row', marginBottom: 2 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },

  dayCircle:         { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: colors.oliGreen },
  dayCircleToday:    { borderWidth: 1.5, borderColor: colors.oliGreen },

  dayNum:          { fontSize: 14, color: colors.oliDarkGray, fontWeight: '400' },
  dayNumSelected:  { color: colors.white, fontWeight: '700' },
  dayNumToday:     { color: colors.oliGreen, fontWeight: '700' },
  dayNumWeekend:   { color: `${colors.gray}80` },
  dayNumPast:      { color: `${colors.gray}50` },

  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.oliGreen, marginTop: 1 },
  dotSelected: { backgroundColor: `${colors.white}CC` },
});

// ─── Styles da tela ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { paddingBottom: 40 },

  header:      { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.oliDarkGray },

  syncChipRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  syncChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  syncChipText:     { fontSize: 12, fontWeight: '700', color: colors.white },
  syncChipDone:     { backgroundColor: `${colors.oliGreen}14` },
  syncChipDoneText: { fontSize: 12, fontWeight: '700', color: colors.oliGreen },

  calendarCard: { backgroundColor: colors.white, borderRadius: radius.lg, margin: spacing.md, padding: spacing.md },

  selectedDateRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  selectedDateText: { fontSize: 14, fontWeight: '600', color: colors.oliGreen, textTransform: 'capitalize' },

  filterRow: { paddingLeft: spacing.md, paddingVertical: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       colors.oliGreen,
    marginRight:       spacing.sm,
    backgroundColor:   colors.white,
  },
  filterChipActive: { backgroundColor: colors.oliGreen },
  filterText:       { fontSize: 13, fontWeight: '500', color: colors.oliDarkGray },
  filterTextActive: { color: colors.white },

  sectionRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginVertical: spacing.sm },
  sectionTitle:   { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray, flex: 1 },
  availableBadge: { backgroundColor: `${colors.oliGreen}1A`, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  availableText:  { fontSize: 12, fontWeight: '700', color: colors.oliGreen },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  roomCard: { width: '47%', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, overflow: 'hidden' },
  roomCoverWrap: {
    alignSelf: 'stretch',
    marginTop: -spacing.md,
    marginHorizontal: -spacing.md,
    marginBottom: spacing.sm,
  },
  roomCover: {
    width: '100%',
    height: 120,
    backgroundColor: colors.border,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoCountText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  roomCardOccupied: { opacity: 0.55 },
  roomCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  roomName: { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },
  roomSpec: { fontSize: 11, color: colors.gray, marginTop: 2 },

  miniTimelineWrap: { marginTop: spacing.sm },
  miniTimelineBar: {
    flexDirection: 'row',
    height:        6,
    borderRadius:  3,
    overflow:      'hidden',
  },
  miniSeg:         { height: 6 },
  miniSegFree:     { backgroundColor: colors.oliGreen },
  miniSegOccupied: { backgroundColor: `${colors.gray}35` },
  miniAxisRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      2,
  },
  miniAxisLabel: { fontSize: 10, color: `${colors.gray}80` },

  roomFreeText: { fontSize: 11, fontWeight: '600', marginTop: 4 },

  // Reservas do dia
  emptyReservations:     { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm, paddingHorizontal: spacing.md },
  emptyReservationsText: { fontSize: 15, fontWeight: '600', color: colors.oliLightGray },
  emptyReservationsSub:  { fontSize: 13, color: colors.oliLightGray },

  reservationCard: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: colors.white,
    borderRadius:   radius.md,
    marginHorizontal: spacing.md,
    marginBottom:   spacing.sm,
    overflow:       'hidden',
  },
  resAccent:     { width: 4, alignSelf: 'stretch', backgroundColor: colors.oliGreen },
  resBody:       { flex: 1, padding: spacing.md },
  resTopRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  resTime:       { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  resRoom:       { fontSize: 13, fontWeight: '500', color: colors.oliGreen },
  resPolicyRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  resPolicyText: { fontSize: 11, fontWeight: '500' },
  resMenuBtn:    { paddingHorizontal: spacing.md, paddingVertical: spacing.md, justifyContent: 'center', alignItems: 'center' },
});
