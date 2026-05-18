import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { supabase } from '../../src/services/supabase';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import type { Profile } from '../../src/services/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(nome: string): string {
  const parts = nome.trim().split(' ').filter(w => w.length > 1);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

// Cor do avatar baseada no nome (consistente por profissional)
const AVATAR_COLORS = [
  '#5F7D67', '#B8893C', '#6B8CAE', '#8C6BAE', '#AE6B6B',
  '#6BAE8C', '#AE8C6B', '#6B6BAE', '#8CAE6B', '#AE6B8C',
];
function avatarColor(nome: string): string {
  let hash = 0;
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Componente de card ────────────────────────────────────────────────────────

function ProfessionalCard({
  profile,
  isMe,
  onPress,
}: {
  profile: Profile;
  isMe: boolean;
  onPress: () => void;
}) {
  const color    = avatarColor(profile.nome);
  const initials = getInitials(profile.nome);

  return (
    <TouchableOpacity
      style={[styles.card, shadows.small]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Ver perfil de ${profile.nome}`}
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        {isMe && (
          <View style={styles.meBadge}>
            <Text style={styles.meBadgeText}>Você</Text>
          </View>
        )}
      </View>

      {/* Nome */}
      <Text style={styles.nome} numberOfLines={1}>{profile.nome}</Text>

      {/* Especialidade */}
      {profile.especialidade ? (
        <View style={styles.specialtyChip}>
          <Text style={styles.specialtyText} numberOfLines={1}>{profile.especialidade}</Text>
        </View>
      ) : (
        <View style={[styles.specialtyChip, styles.specialtyChipEmpty]}>
          <Text style={[styles.specialtyText, { color: colors.oliLightGray }]}>Sem especialidade</Text>
        </View>
      )}

      {/* Bio */}
      <Text style={styles.bio} numberOfLines={3}>
        {profile.bio ?? 'Nenhuma descrição adicionada ainda.'}
      </Text>

      {/* CRM */}
      {profile.crm ? (
        <Text style={styles.crm}>{profile.crm}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Modal de detalhes do profissional ────────────────────────────────────────

function ProfessionalDetailModal({
  profile,
  isMe,
  onClose,
}: {
  profile: Profile | null;
  isMe: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  if (!profile) return null;

  const color    = avatarColor(profile.nome);
  const initials = getInitials(profile.nome);

  const memberSince = (() => {
    const d = new Date(profile.created_at);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  })();

  const planLabel = profile.plan === 'premium' ? 'Premium' : profile.plan === 'basic' ? 'Basic' : profile.plan;

  return (
    <Modal
      visible={profile !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[detailStyles.root, { paddingTop: insets.top > 0 ? insets.top : spacing.md }]}>
        {/* Handle bar */}
        <View style={detailStyles.handle} />

        {/* Close */}
        <TouchableOpacity
          style={detailStyles.closeBtn}
          onPress={onClose}
          accessibilityLabel="Fechar perfil"
        >
          <Ionicons name="close" size={22} color={colors.oliDarkGray} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={detailStyles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Avatar + nome ── */}
          <View style={detailStyles.heroSection}>
            <View style={[detailStyles.heroAvatar, { backgroundColor: color }]}>
              <Text style={detailStyles.heroAvatarText}>{initials}</Text>
            </View>

            {isMe && (
              <View style={detailStyles.meBadge}>
                <Text style={detailStyles.meBadgeText}>Você</Text>
              </View>
            )}

            <Text style={detailStyles.heroName}>{profile.nome}</Text>

            {profile.especialidade ? (
              <View style={detailStyles.specialtyChip}>
                <Text style={detailStyles.specialtyText}>{profile.especialidade}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Sobre ── */}
          <View style={[detailStyles.card, shadows.small]}>
            <View style={detailStyles.cardHeader}>
              <Text style={detailStyles.sectionLabel}>SOBRE</Text>
              <Ionicons name="person-outline" size={16} color={colors.oliGreen} />
            </View>
            <Text style={detailStyles.bioText}>
              {profile.bio ?? 'Nenhuma descrição adicionada ainda.'}
            </Text>
          </View>

          {/* ── Perfil Clínico ── */}
          <View style={[detailStyles.card, shadows.small]}>
            <View style={detailStyles.cardHeader}>
              <Text style={detailStyles.sectionLabel}>PERFIL CLÍNICO</Text>
              <Ionicons name="medical-outline" size={16} color={colors.oliGreen} />
            </View>

            <InfoRow
              icon="ribbon-outline"
              label="CRM"
              value={profile.crm ?? 'Não informado'}
            />
            <InfoRow
              icon="time-outline"
              label="Duração da consulta"
              value={`${profile.consultation_duration_minutes} min`}
            />
            <InfoRow
              icon="calendar-outline"
              label="Membro desde"
              value={memberSince}
            />
            <InfoRow
              icon="star-outline"
              label="Plano"
              value={planLabel}
              isLast
            />
          </View>

          {/* ── Contato ── */}
          <View style={[detailStyles.card, shadows.small]}>
            <View style={detailStyles.cardHeader}>
              <Text style={detailStyles.sectionLabel}>CONEXÃO</Text>
              <Ionicons name="link-outline" size={16} color={colors.oliGreen} />
            </View>

            <View style={detailStyles.connectionNote}>
              <Ionicons name="people-outline" size={20} color={colors.oliGreen} />
              <Text style={detailStyles.connectionNoteText}>
                Encontre {profile.nome.split(' ')[0]} nas salas do OLI ou na recepção durante os dias de atendimento.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function InfoRow({
  icon, label, value, isLast,
}: {
  icon: string; label: string; value: string; isLast?: boolean;
}) {
  return (
    <View style={[detailStyles.infoRow, !isLast && detailStyles.infoRowBorder]}>
      <View style={detailStyles.infoIconWrap}>
        <Ionicons name={icon as any} size={16} color={colors.oliGreen} />
      </View>
      <Text style={detailStyles.infoLabel}>{label}</Text>
      <Text style={detailStyles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export default function ComunidadeScreen() {
  const { session } = useAuthStore();
  const [profiles,         setProfiles]         = useState<Profile[]>([]);
  const [query,            setQuery]            = useState('');
  const [refreshing,       setRefreshing]       = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [selectedProfile,  setSelectedProfile]  = useState<Profile | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('nome');
    if (data) setProfiles(data as Profile[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = profiles.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.especialidade?.toLowerCase().includes(q) ?? false) ||
      (p.crm?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfessionalDetailModal
        profile={selectedProfile}
        isMe={selectedProfile?.id === session?.user?.id}
        onClose={() => setSelectedProfile(null)}
      />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Comunidade OLI</Text>
          <Text style={styles.headerSub}>
            {profiles.length} {profiles.length === 1 ? 'profissional' : 'profissionais'} ativos
          </Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="people" size={22} color={colors.oliGreen} />
        </View>
      </View>

      {/* Busca */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.gray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nome ou especialidade…"
          placeholderTextColor={colors.oliLightGray}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Buscar profissionais"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={18} color={colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.oliGreen} />}
      >
        {loading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Carregando…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={40} color={colors.oliLightGray} />
            <Text style={styles.emptyText}>
              {query ? 'Nenhum profissional encontrado' : 'Nenhum profissional na comunidade ainda'}
            </Text>
          </View>
        ) : (
          <View style={styles.row}>
            {filtered.map(p => (
              <ProfessionalCard
                key={p.id}
                profile={p}
                isMe={p.id === session?.user?.id}
                onPress={() => setSelectedProfile(p)}
              />
            ))}
          </View>
        )}

        {/* Aviso Communicare */}
        <View style={styles.syncNote}>
          <Ionicons name="link-outline" size={14} color={colors.gray} />
          <Text style={styles.syncNoteText}>
            Na Fase 3, perfis serão sincronizados com o Communicare automaticamente.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_WIDTH = '47%';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oliBackground },

  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: spacing.md,
    paddingTop:     spacing.md,
    paddingBottom:  spacing.sm,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.oliDarkGray },
  headerSub:   { fontSize: 13, color: colors.oliLightGray, marginTop: 2 },
  headerIcon:  {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: `${colors.oliGreen}15`,
    justifyContent: 'center', alignItems: 'center',
  },

  searchWrap: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  colors.white,
    borderRadius:     radius.full,
    marginHorizontal: spacing.md,
    marginBottom:     spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical:  spacing.sm,
    ...shadows.small,
  },
  searchIcon:  { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, color: colors.oliDarkGray },

  grid: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  row:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  // Card
  card: {
    width:           CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    alignItems:      'center',
  },

  avatarWrap: { position: 'relative', marginBottom: spacing.sm },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.white },
  meBadge: {
    position:        'absolute',
    bottom:          -4,
    right:           -4,
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.full,
    paddingHorizontal: 6,
    paddingVertical:  1,
    borderWidth:     2,
    borderColor:     colors.white,
  },
  meBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white },

  nome: { fontSize: 14, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center', marginBottom: 6 },

  specialtyChip: {
    backgroundColor:  `${colors.oliGreen}15`,
    borderRadius:     radius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
    marginBottom:     spacing.sm,
    maxWidth:         '100%',
  },
  specialtyChipEmpty: { backgroundColor: `${colors.gray}10` },
  specialtyText: { fontSize: 11, fontWeight: '600', color: colors.oliGreen, textAlign: 'center' },

  bio: { fontSize: 12, color: colors.gray, textAlign: 'center', lineHeight: 17 },
  crm: { fontSize: 11, color: colors.oliLightGray, marginTop: spacing.xs },

  emptyWrap: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm, width: '100%' },
  emptyText: { fontSize: 14, color: colors.oliLightGray, textAlign: 'center' },

  syncNote: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            spacing.xs,
    marginTop:      spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  syncNoteText: { fontSize: 12, color: colors.gray, flex: 1, lineHeight: 17 },
});

// ─── Detail Modal Styles ──────────────────────────────────────────────────────

const detailStyles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.oliBackground,
  },
  handle: {
    width:           40,
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    spacing.sm,
  },
  closeBtn: {
    position:        'absolute',
    top:             spacing.md,
    right:           spacing.md,
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: `${colors.oliDarkGray}10`,
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          10,
  },
  scroll: {
    padding:         spacing.md,
    paddingBottom:   48,
    gap:             spacing.md,
  },

  // Hero
  heroSection: {
    alignItems:    'center',
    paddingTop:    spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroAvatar: {
    width:          96,
    height:         96,
    borderRadius:   48,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },
  heroAvatarText: { fontSize: 36, fontWeight: '700', color: colors.white },
  meBadge: {
    backgroundColor:  colors.oliGreen,
    borderRadius:     radius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
    marginBottom:     spacing.xs,
  },
  meBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white },
  heroName: {
    fontSize:     22,
    fontWeight:   '700',
    color:        colors.oliDarkGray,
    textAlign:    'center',
    marginBottom: spacing.xs,
  },
  specialtyChip: {
    backgroundColor:   `${colors.oliGreen}18`,
    borderRadius:      radius.full,
    paddingHorizontal: 14,
    paddingVertical:   4,
  },
  specialtyText: { fontSize: 13, fontWeight: '600', color: colors.oliGreen },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
  },
  cardHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },
  sectionLabel: {
    fontSize:    11,
    fontWeight:  '700',
    color:       colors.oliLightGray,
    letterSpacing: 0.8,
  },

  // Bio
  bioText: {
    fontSize:   14,
    color:      colors.gray,
    lineHeight: 22,
  },

  // Info rows
  infoRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: spacing.sm,
    gap:            spacing.sm,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoIconWrap: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: `${colors.oliGreen}12`,
    justifyContent:  'center',
    alignItems:      'center',
  },
  infoLabel: { flex: 1, fontSize: 14, color: colors.gray },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },

  // Connection note
  connectionNote: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    gap:              spacing.sm,
    backgroundColor:  `${colors.oliGreen}08`,
    borderRadius:     radius.md,
    padding:          spacing.md,
  },
  connectionNoteText: {
    flex:       1,
    fontSize:   13,
    color:      colors.gray,
    lineHeight: 19,
  },
});
