/**
 * CommunicareAgendaCard — agenda de pacientes do dia (fonte: Communicare).
 * 4 buckets: Em atendimento, Em espera, Próximos, Atendidos.
 * Gated por config — se CC não configurado, não renderiza nada.
 */

import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCommunicareAgenda } from '../hooks/useCommunicareAgenda';
import type { CCAppointment } from '../services/communicareAgenda';
import { colors, spacing, radius, shadows } from '../theme/designSystem';

interface Props {
  professionalId?: string;
  clinicId?:       string;
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function Row({ appt, tint }: { appt: CCAppointment; tint: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{appt.patientName}</Text>
        {appt.procedure ? (
          <Text style={styles.rowProc} numberOfLines={1}>{appt.procedure}</Text>
        ) : null}
      </View>
      {appt.isTeleconsultation ? (
        <Ionicons name="videocam-outline" size={15} color={colors.oliGreen} style={styles.teleIcon} />
      ) : null}
      <Text style={styles.rowTime}>{fmtTime(appt.startTime)}</Text>
    </View>
  );
}

function Bucket({
  title, icon, tint, appts,
}: { title: string; icon: keyof typeof Ionicons.glyphMap; tint: string; appts: CCAppointment[] }) {
  if (appts.length === 0) return null;
  return (
    <View style={styles.bucket}>
      <View style={styles.bucketHeader}>
        <Ionicons name={icon} size={15} color={tint} />
        <Text style={[styles.bucketTitle, { color: tint }]}>{title}</Text>
        <View style={[styles.countPill, { backgroundColor: `${tint}1A` }]}>
          <Text style={[styles.countText, { color: tint }]}>{appts.length}</Text>
        </View>
      </View>
      {appts.map(a => <Row key={a.scheduleId} appt={a} tint={tint} />)}
    </View>
  );
}

export function CommunicareAgendaCard({ professionalId, clinicId }: Props) {
  const { buckets, loading, enabled } = useCommunicareAgenda(professionalId, clinicId);

  if (!enabled) return null;

  const total =
    buckets.proximos.length + buckets.emEspera.length +
    buckets.emAtendimento.length + buckets.atendidos.length;

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda de Pacientes</Text>
        {loading ? <ActivityIndicator size="small" color={colors.oliGreen} /> : null}
      </View>

      {total === 0 ? (
        <Text style={styles.empty}>Nenhum atendimento agendado para hoje.</Text>
      ) : (
        <>
          <Bucket title="Em atendimento" icon="medkit"          tint={colors.oliGreen} appts={buckets.emAtendimento} />
          <Bucket title="Em espera"      icon="time"            tint={colors.oliGold}  appts={buckets.emEspera} />
          <Bucket title="Próximos"       icon="calendar-outline" tint={colors.oliDarkGray} appts={buckets.proximos} />
          <Bucket title="Atendidos"      icon="checkmark-circle" tint={colors.gray}     appts={buckets.atendidos} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.md,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },
  empty: { fontSize: 13, color: colors.gray, paddingVertical: spacing.sm },

  bucket: { marginTop: spacing.sm },
  bucketHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  4,
  },
  bucketTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  countPill: {
    borderRadius:      radius.sm,
    paddingHorizontal: 7,
    paddingVertical:   1,
    marginLeft:        2,
  },
  countText: { fontSize: 11, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 6,
    gap:           spacing.sm,
  },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '500', color: colors.oliDarkGray },
  rowProc: { fontSize: 12, color: colors.gray, marginTop: 1 },
  teleIcon: { marginRight: 2 },
  rowTime: { fontSize: 13, fontWeight: '600', color: colors.oliLightGray },
});
