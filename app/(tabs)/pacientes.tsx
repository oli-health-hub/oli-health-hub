import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, StyleSheet, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePatientStore }  from '../../src/store/patientStore';
import { useAppStore }      from '../../src/store/appStore';
import { useAuthStore }     from '../../src/store/authStore';
import { useTimer }         from '../../src/hooks/useTimer';
import { PacienteRow }      from '../../src/components/PacienteRow';
import { PacienteDetail }   from '../../src/components/PacienteDetail';
import { AddPacienteModal }  from '../../src/components/AddPacienteModal';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import type { Patient } from '../../src/models/types';

export default function PacientesScreen() {
  const { patients, isLoaded, loadPatients } = usePatientStore();
  const { todayReservations } = useAppStore();
  const { profile } = useAuthStore();
  const timer = useTimer();

  const [search,          setSearch]          = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAdd,         setShowAdd]         = useState(false);

  // Passa o professionalId para buscar do Supabase na primeira carga
  useEffect(() => {
    if (!isLoaded) loadPatients(profile?.id);
  }, [isLoaded, profile?.id]);

  const filtered = search
    ? patients.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()))
    : patients;

  const currentRoom        = timer.isRunning ? todayReservations[0]?.roomName : undefined;
  const activeReservation  = todayReservations[0];


  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Banner: sala em uso ── */}
      {timer.isRunning && currentRoom && (
        <View style={styles.sessionBanner}>
          <Ionicons name="medkit-outline" size={16} color={colors.white} />
          <Text style={styles.sessionBannerText}>
            {currentRoom} em uso
          </Text>
        </View>
      )}

      {/* ── Métricas CRM ── */}
      <View style={styles.metricsWrap}>
        <MetricCard title="Conversão" value="—" trend="" positive />
        <MetricCard title="Retornos"  value="—" trend="" positive />
        <MetricCard title="NPS"       value="—" trend="" positive />
        <MetricCard title="Pacientes" value={String(patients.length)} trend="" positive />
      </View>

      {/* ── Barra de busca + botão adicionar ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar paciente..."
            placeholderTextColor={colors.gray}
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Buscar paciente por nome"
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
          accessibilityLabel="Adicionar novo paciente"
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* ── Lista ── */}
      {!isLoaded ? (
        <View style={styles.centerMsg}>
          <ActivityIndicator size="large" color={colors.oliGreen} />
          <Text style={styles.centerText}>Carregando...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerMsg}>
          <Ionicons name="people-outline" size={48} color={colors.oliLightGray} />
          <Text style={styles.emptyTitle}>
            {search ? 'Nenhum resultado' : 'Nenhum paciente cadastrado'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'Tente um nome diferente.' : 'Toque em + para adicionar seu primeiro paciente.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedPatient(item)}
              accessibilityLabel={
                timer.isRunning
                  ? `Iniciar atendimento com ${item.nome} ou ver detalhes`
                  : `Ver detalhes de ${item.nome}`
              }
            >
              <PacienteRow paciente={item} showSessionHint={timer.isRunning} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Modal: Detalhes ── */}
      <Modal visible={!!selectedPatient} animationType="slide" presentationStyle="pageSheet">
        {selectedPatient && (
          <PacienteDetail
            paciente={selectedPatient}
            onClose={() => setSelectedPatient(null)}
            currentRoom={currentRoom}
            onIniciarAtendimento={undefined}
          />
        )}
      </Modal>

      {/* ── Modal: Adicionar ── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <AddPacienteModal onClose={() => setShowAdd(false)} />
      </Modal>
    </SafeAreaView>
  );
}

// ── Cartão de métrica ─────────────────────────────────────────────────────────

function MetricCard({ title, value, trend, positive }: {
  title: string; value: string; trend: string; positive: boolean;
}) {
  return (
    <View style={[metricStyles.card, shadows.small]}>
      <Text style={metricStyles.title}>{title}</Text>
      <Text style={metricStyles.value}>{value}</Text>
      {trend ? (
        <View style={metricStyles.trendRow}>
          <Ionicons
            name={positive ? 'arrow-up-outline' : 'arrow-down-outline'}
            size={10}
            color={positive ? colors.oliGreen : colors.oliRed}
          />
          <Text style={[metricStyles.trend, { color: positive ? colors.oliGreen : colors.oliRed }]}>
            {trend}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card:     { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
  title:    { fontSize: 11, fontWeight: '500', color: colors.gray, marginBottom: 4 },
  value:    { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  trend:    { fontSize: 11, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oliBackground },

  sessionBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: colors.oliGreen,
    paddingHorizontal: spacing.md,
    paddingVertical:   10,
  },
  sessionBannerText: { fontSize: 13, fontWeight: '600', color: colors.white, flex: 1 },

  metricsWrap: {
    flexDirection:  'row',
    gap:            spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    ...shadows.small,
  },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  searchBox: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    backgroundColor:   colors.white,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   10,
    ...shadows.small,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.oliDarkGray },
  addBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: colors.oliGreen,
    justifyContent:  'center',
    alignItems:      'center',
  },

  list:          { paddingHorizontal: spacing.md, paddingBottom: 40 },
  centerMsg:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  centerText:    { fontSize: 16, color: colors.gray },
  emptyTitle:    { fontSize: 18, fontWeight: '600', color: colors.oliDarkGray, marginTop: spacing.md, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.gray, marginTop: spacing.sm, textAlign: 'center' },
});
