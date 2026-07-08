import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/authStore';
import { colors, spacing, radius } from '../src/theme/designSystem';
import { fetchTotalOlicoins, ACTION_OBJECTIVES } from '../src/services/olicoinsService';
import { ACHIEVEMENT_TRACKS } from '../src/services/achievementsService';
import { supabase } from '../src/services/supabase';
import { PROFILE_SECTIONS } from '../src/utils/profileSections';

const TRACK_ROUTE: Record<string, string> = {
  reservas:      '/(tabs)/agenda',
  pacientes:     '/(tabs)/pacientes',
  comunidade:    '/(tabs)/comunidade',
  horas_sala:    '/(tabs)/agenda',
  pacotes_horas: '/(tabs)/financeiro',
};

// Rota pra onde a ação de cada objetivo acontece de verdade — sem formulário
// aqui dentro, só título + status. Perfil pros dados; cada tela própria pro resto.
const ACTION_ROUTE: Record<string, string> = {
  primeira_reserva:      '/(tabs)/agenda',
  primeiro_paciente:     '/(tabs)/pacientes',
  primeiro_post:         '/(tabs)/comunidade',
  indicacao_enviada:     '/indicacao',
  modulo_ativo:          '/(tabs)/ecossistema',
  primeiro_atendimento:  '/(tabs)/agenda',
  primeiro_pacote_horas: '/(tabs)/financeiro',
  primeiro_like:         '/(tabs)/comunidade',
  primeiro_comentario:   '/(tabs)/comunidade',
  mfa_ativado:           '/mfa-setup',
  plano_anual:           '/(tabs)/ecossistema',
};

interface MedalItem {
  id: string; titulo: string; descricao: string; pontos: number; done: boolean; route: string;
}

function MedalCard({ item, icon, onPress }: { item: MedalItem; icon: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={qStyles.medalCard} onPress={onPress} accessibilityLabel={item.titulo}>
      <View style={[qStyles.medal, item.done && qStyles.medalDone]}>
        <Ionicons name={item.done ? 'checkmark' : (icon as any)} size={24} color={item.done ? colors.white : colors.oliGold} />
        {!item.done && (
          <View style={qStyles.pointsChip}>
            <FontAwesome5 name="coins" size={8} color={colors.oliGold} />
            <Text style={qStyles.pointsChipText}>+{item.pontos}</Text>
          </View>
        )}
      </View>
      <View style={qStyles.medalTitleWrap}>
        <Text style={qStyles.medalTitle} numberOfLines={2} ellipsizeMode="tail">{item.titulo}</Text>
      </View>
      <View style={qStyles.medalDescWrap}>
        <Text style={qStyles.medalDesc} numberOfLines={2} ellipsizeMode="tail">{item.done ? 'Concluído' : item.descricao}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MedalGrid({ title, icon, items, onPressItem, first }: {
  title: string; icon: string; items: MedalItem[]; onPressItem: (item: MedalItem) => void; first?: boolean;
}) {
  const done = items.filter(i => i.done).length;
  return (
    <View style={[qStyles.section, !first && qStyles.sectionDivider]}>
      <View style={qStyles.sectionHeader}>
        <Text style={qStyles.sectionTitle}>{title}</Text>
        <View style={qStyles.sectionCountBadge}>
          <Text style={qStyles.sectionCount}>{done}/{items.length}</Text>
        </View>
      </View>
      <View style={qStyles.grid}>
        {items.map(item => (
          <MedalCard key={item.id} item={item} icon={icon} onPress={() => onPressItem(item)} />
        ))}
      </View>
    </View>
  );
}

export default function CompletarPerfilScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [olicoins, setOlicoins] = useState(0);
  const [actionEventos, setActionEventos] = useState<Set<string>>(new Set());
  const [trackValues, setTrackValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!profile?.id) return;
    fetchTotalOlicoins(profile.id).then(setOlicoins);
    supabase.from('olicoins_ledger').select('evento').eq('professional_id', profile.id).then(({ data }) => {
      setActionEventos(new Set((data ?? []).map(r => r.evento)));
    });
    Promise.all(ACHIEVEMENT_TRACKS.map(t => t.metric(profile.id).then(v => [t.id, v] as const))).then(entries => {
      setTrackValues(Object.fromEntries(entries));
    });
  }, [profile?.id]);

  if (!profile) return null;

  const profileItems: MedalItem[] = PROFILE_SECTIONS.map(s => ({
    id: s.id, titulo: s.titulo, descricao: s.descricao, pontos: s.pontos, done: s.isComplete(profile), route: '/perfil',
  }));
  const actionItems: MedalItem[] = ACTION_OBJECTIVES.map(o => ({
    id: o.id, titulo: o.titulo, descricao: o.descricao, pontos: o.pontos, done: actionEventos.has(o.evento), route: ACTION_ROUTE[o.id],
  }));
  const achievementItems: MedalItem[] = ACHIEVEMENT_TRACKS.flatMap(track =>
    track.tiers.map(tier => {
      const valor = trackValues[track.id] ?? 0;
      return {
        id: tier.evento,
        titulo: `${track.titulo} — ${tier.label}`,
        descricao: `${valor} de ${tier.threshold} ${track.unidade}`,
        pontos: tier.pontos,
        done: actionEventos.has(tier.evento),
        route: TRACK_ROUTE[track.id],
      };
    }),
  );

  const totalCompleted = [...profileItems, ...actionItems].filter(i => i.done).length;
  const totalItems = profileItems.length + actionItems.length;

  const goTo = (item: MedalItem) => router.push(item.route as never);

  return (
    <SafeAreaProvider>
    <SafeAreaView style={qStyles.safe} edges={['top']}>
      <View style={qStyles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.oliDarkGray} />
        </TouchableOpacity>
        <Text style={qStyles.headerTitle}>Seus objetivos</Text>
        <View style={qStyles.coinsBadge}>
          <FontAwesome5 name="coins" size={12} color={colors.oliGold} />
          <Text style={qStyles.coinsText}>{olicoins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={qStyles.content}>
        <Text style={qStyles.progress}>{totalCompleted} de {totalItems} objetivos completos</Text>

        <MedalGrid first title="Seu perfil" icon="person-outline" items={profileItems} onPressItem={goTo} />
        <MedalGrid title="No dia a dia" icon="flash-outline" items={actionItems} onPressItem={goTo} />
        <MedalGrid title="Conquistas" icon="trophy-outline" items={achievementItems} onPressItem={goTo} />
      </ScrollView>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const CARD_WIDTH = '47%';

const qStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oliBackground },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.oliDarkGray },
  coinsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${colors.oliGold}1A`, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  coinsText: { fontSize: 13, fontWeight: '700', color: colors.oliGold },
  content: { padding: spacing.md, paddingBottom: 40 },
  progress: { fontSize: 13, color: colors.oliLightGray, marginBottom: spacing.md },

  section: { marginBottom: spacing.xl },
  sectionDivider: { paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.oliLightGray,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  sectionCountBadge: {
    backgroundColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  sectionCount: { fontSize: 11, fontWeight: '700', color: colors.oliDarkGray },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  medalCard: {
    width: CARD_WIDTH, alignItems: 'center', marginBottom: spacing.md,
  },
  medal: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: `${colors.oliGold}1A`,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs,
  },
  medalDone: { backgroundColor: colors.oliGreen },
  pointsChip: {
    position: 'absolute', bottom: -6, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: `${colors.oliGold}40`,
  },
  pointsChipText: { fontSize: 9, fontWeight: '700', color: colors.oliDarkGray },
  medalTitleWrap: {
    height: 34, width: '100%', justifyContent: 'flex-start', alignItems: 'center', marginTop: 4,
  },
  medalTitle: {
    fontSize: 12, lineHeight: 15, fontWeight: '700', color: colors.oliDarkGray,
    textAlign: 'center',
  },
  medalDescWrap: {
    height: 28, width: '100%', justifyContent: 'flex-start', alignItems: 'center', marginTop: 2,
  },
  medalDesc: {
    fontSize: 10, lineHeight: 13, color: colors.oliLightGray,
    textAlign: 'center',
  },
});
