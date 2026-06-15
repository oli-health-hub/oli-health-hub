import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../theme/designSystem';
import { getRoomPhotos } from '../utils/roomPhotos';
import {
  buildDaySegments, buildFreeBlocks, HOUR_MARKS,
  DAY_START_MIN, DAY_TOTAL_MIN,
} from '../utils/roomTimeline';
import type { Room, Reservation } from '../models/types';

interface Props {
  room:         Room;
  selectedDate: Date;
  reservations: Reservation[];
  onClose:      () => void;
  onReserve:    () => void;
}

const MONTHS = [
  'jan','fev','mar','abr','mai','jun',
  'jul','ago','set','out','nov','dez',
];

export function RoomDetailModal({
  room, selectedDate, reservations, onClose, onReserve,
}: Props) {
  const segments   = buildDaySegments(selectedDate, reservations, room.name);
  const freeBlocks = buildFreeBlocks(segments, selectedDate);
  const hasFree    = freeBlocks.length > 0;

  const dateLabel = `${selectedDate.getDate()} de ${MONTHS[selectedDate.getMonth()]}`;
  const photos    = getRoomPhotos(room.id);

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar detalhes da sala">
          <Ionicons name="close" size={24} color={colors.oliDarkGray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{room.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Foto(s) da sala ── */}
        {photos.length === 0 ? (
          <View style={[styles.photoPlaceholder, shadows.small]}>
            <Ionicons name="camera-outline" size={36} color={colors.oliLightGray} />
            <Text style={styles.photoPlaceholderText}>Fotos em breve</Text>
          </View>
        ) : photos.length === 1 ? (
          <Image source={photos[0]} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
          >
            {photos.map((p, i) => (
              <Image key={i} source={p} style={styles.carouselPhoto} resizeMode="cover" accessibilityIgnoresInvertColors />
            ))}
          </ScrollView>
        )}

        {/* ── Especialidades + status ── */}
        <View style={styles.specialtiesRow}>
          {room.specialties.map(s => (
            <View key={s} style={styles.specialtyChip}>
              <Text style={styles.specialtyText}>{s}</Text>
            </View>
          ))}
          <View style={[
            styles.specialtyChip,
            room.isAvailable ? styles.availableChip : styles.occupiedChip,
          ]}>
            <Text style={[
              styles.specialtyText,
              room.isAvailable ? styles.availableChipText : styles.occupiedChipText,
            ]}>
              {room.isAvailable ? 'Disponível' : 'Ocupada'}
            </Text>
          </View>
        </View>

        {/* ── Disponibilidade do dia ── */}
        <Text style={styles.sectionLabel}>
          DISPONIBILIDADE · {dateLabel.toUpperCase()}
        </Text>

        <View style={[styles.timelineCard, shadows.small]}>

          {/* Barra de timeline */}
          <View style={styles.timelineWrap}>
            {/* Segmentos coloridos */}
            <View style={styles.timelineBar}>
              {segments.map((seg, i) => (
                <View
                  key={i}
                  style={[
                    styles.timelineSeg,
                    { flex: seg.endMin - seg.startMin },
                    seg.type === 'free'
                      ? styles.timelineSegFree
                      : styles.timelineSegOccupied,
                    i === 0                    && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                    i === segments.length - 1  && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
                  ]}
                />
              ))}
            </View>

            {/* Marcadores de hora */}
            <View style={styles.hourRow}>
              {HOUR_MARKS.map(h => {
                const pct = ((h * 60 - DAY_START_MIN) / DAY_TOTAL_MIN) * 100;
                return (
                  <View
                    key={h}
                    style={[styles.hourMark, { left: `${pct}%` as any }]}
                  >
                    <View style={styles.hourTick} />
                    <Text style={styles.hourLabel}>{h}h</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Legenda */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.oliGreen }]} />
              <Text style={styles.legendText}>Livre</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: `${colors.gray}50` }]} />
              <Text style={styles.legendText}>Reservado</Text>
            </View>
          </View>

          {/* Blocos livres */}
          {hasFree ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.freeBlocksTitle}>Horários disponíveis</Text>
              <View style={styles.freeBlocksRow}>
                {freeBlocks.map((block, i) => (
                  <View key={i} style={styles.freeBlock}>
                    <Text style={styles.freeBlockTime}>{block.label}</Text>
                    <Text style={styles.freeBlockDur}>{block.duration}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.divider} />
              <View style={styles.noFreeWrap}>
                <Ionicons name="time-outline" size={16} color={colors.oliLightGray} />
                <Text style={styles.noFreeText}>Nenhum horário livre neste dia</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Equipamentos ── */}
        <Text style={styles.sectionLabel}>EQUIPAMENTOS E MOBILIÁRIO</Text>
        <View style={[styles.itemsCard, shadows.small]}>
          {room.items.map((item, i) => (
            <View
              key={item}
              style={[styles.itemRow, i < room.items.length - 1 && styles.itemRowBorder]}
            >
              <Ionicons name="checkmark-circle" size={16} color={colors.oliGreen} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* ── Observação ── */}
        {room.note ? (
          <View style={[styles.noteCard, shadows.small]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.oliGold} />
            <Text style={styles.noteText}>{room.note}</Text>
          </View>
        ) : null}

      </ScrollView>

      {/* ── Botão reservar ── */}
      {room.isAvailable && hasFree && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.reserveBtn}
            onPress={onReserve}
            accessibilityLabel={`Reservar ${room.name}`}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.white} />
            <Text style={styles.reserveBtnText}>Reservar esta sala</Text>
          </TouchableOpacity>
        </View>
      )}
      {room.isAvailable && !hasFree && (
        <View style={styles.footer}>
          <View style={styles.reserveBtnDisabled}>
            <Ionicons name="calendar-outline" size={18} color={colors.oliLightGray} />
            <Text style={styles.reserveBtnDisabledText}>Sem horários livres neste dia</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.oliBackground },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    padding:           spacing.md,
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },

  scroll:        { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },

  photoPlaceholder: {
    height:          160,
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
  },
  photoPlaceholderText: { fontSize: 13, color: colors.oliLightGray },
  photo: {
    height:          200,
    borderRadius:    radius.lg,
    backgroundColor: colors.border,
  },
  carousel: { borderRadius: radius.lg },
  carouselPhoto: {
    width:           Dimensions.get('window').width - spacing.md * 2,
    height:          200,
    borderRadius:    radius.lg,
    backgroundColor: colors.border,
    marginRight:     spacing.sm,
  },

  specialtiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  specialtyChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:      radius.full,
    backgroundColor:   `${colors.oliGreen}15`,
  },
  specialtyText:     { fontSize: 12, fontWeight: '600', color: colors.oliGreen },
  availableChip:     { backgroundColor: `${colors.oliGreen}20` },
  availableChipText: { color: colors.oliGreen },
  occupiedChip:      { backgroundColor: `${colors.oliRed}15` },
  occupiedChipText:  { color: colors.oliRed },

  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         colors.gray,
    letterSpacing: 0.5,
  },

  // Timeline
  timelineCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },

  timelineWrap: { marginBottom: spacing.sm },

  timelineBar: {
    flexDirection: 'row',
    height:        14,
    borderRadius:  6,
    overflow:      'hidden',
    marginBottom:  20,   // espaço para as marcas de hora
  },
  timelineSeg:         { height: 14 },
  timelineSegFree:     { backgroundColor: colors.oliGreen },
  timelineSegOccupied: { backgroundColor: `${colors.gray}35` },

  hourRow: { position: 'relative', height: 16 },
  hourMark: {
    position:  'absolute',
    alignItems: 'center',
    transform: [{ translateX: -10 }],
  },
  hourTick:  { width: 1, height: 4, backgroundColor: `${colors.gray}60`, marginBottom: 2 },
  hourLabel: { fontSize: 9, color: colors.gray, fontWeight: '500' },

  legend:     { flexDirection: 'row', gap: spacing.md, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.gray },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },

  freeBlocksTitle: { fontSize: 12, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.sm },
  freeBlocksRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  freeBlock: {
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.md,
    backgroundColor:   `${colors.oliGreen}12`,
    borderWidth:       1,
    borderColor:       `${colors.oliGreen}30`,
  },
  freeBlockTime: { fontSize: 13, fontWeight: '700', color: colors.oliGreen },
  freeBlockDur:  { fontSize: 10, color: colors.oliGreen, marginTop: 1, opacity: 0.75 },

  noFreeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noFreeText: { fontSize: 13, color: colors.oliLightGray },

  // Equipamentos
  itemsCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    padding:       spacing.md,
  },
  itemRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemText:      { fontSize: 14, color: colors.oliDarkGray, flex: 1 },

  noteCard: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.sm,
    backgroundColor: `${colors.oliGold}12`,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  noteText: { fontSize: 13, color: colors.oliDarkGray, flex: 1, lineHeight: 18 },

  // Footer
  footer: {
    padding:         spacing.md,
    backgroundColor: colors.white,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  reserveBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  reserveBtnText:         { color: colors.white, fontSize: 16, fontWeight: '700' },
  reserveBtnDisabled:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: `${colors.gray}15`, borderRadius: radius.md, padding: spacing.md },
  reserveBtnDisabledText: { color: colors.oliLightGray, fontSize: 15, fontWeight: '600' },
});
