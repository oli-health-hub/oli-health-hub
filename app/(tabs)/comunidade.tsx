import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Modal, Image,
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

const AVATAR_COLORS = [
  '#5F7D67', '#B8893C', '#6B8CAE', '#8C6BAE', '#AE6B6B',
  '#6BAE8C', '#AE8C6B', '#6B6BAE', '#8CAE6B', '#AE6B8C',
];
function avatarColor(nome: string): string {
  let hash = 0;
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function AvatarCircle({
  profile,
  size,
}: {
  profile: Profile;
  size: number;
}) {
  const color    = avatarColor(profile.nome);
  const initials = getInitials(profile.nome);
  return profile.foto_url ? (
    <Image
      source={{ uri: profile.foto_url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      accessibilityLabel={`Foto de ${profile.nome}`}
    />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.34, fontWeight: '700', color: colors.white }}>{initials}</Text>
    </View>
  );
}

// ─── Card compacto (grid 2 colunas) ──────────────────────────────────────────

function ProfessionalCard({
  profile,
  isMe,
  referidoPor,
  onPress,
}: {
  profile: Profile;
  isMe: boolean;
  referidoPor: Profile | null;
  onPress: () => void;
}) {
  const tiposAtend = (profile as any).tipos_atendimento as string[] | undefined;
  const convenios  = (profile as any).convenios as string[] | undefined;

  return (
    <TouchableOpacity
      style={[styles.card, shadows.small]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Ver perfil de ${profile.nome}`}
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <AvatarCircle profile={profile} size={64} />
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
      <Text style={styles.bio} numberOfLines={2}>
        {profile.bio ?? 'Nenhuma descrição adicionada ainda.'}
      </Text>

      {/* Tipos de atendimento — até 2 chips */}
      {tiposAtend && tiposAtend.length > 0 && (
        <View style={styles.tagRow}>
          {tiposAtend.slice(0, 2).map(t => (
            <View key={t} style={styles.tagChip}>
              <Text style={styles.tagText} numberOfLines={1}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Indicação */}
      {referidoPor && (
        <View style={styles.referralBadge}>
          <Ionicons name="link-outline" size={11} color={colors.oliGold} />
          <Text style={styles.referralText} numberOfLines={1}>
            Indicado por {referidoPor.nome.split(' ')[0]}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Modal de detalhes ────────────────────────────────────────────────────────

function ProfessionalDetailModal({
  profile,
  isMe,
  referidoPor,
  onClose,
}: {
  profile: Profile | null;
  isMe: boolean;
  referidoPor: Profile | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  if (!profile) return null;

  const tiposAtend = ((profile as any).tipos_atendimento as string[] | undefined) ?? [];
  const convenios  = ((profile as any).convenios as string[] | undefined) ?? [];

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
        <View style={detailStyles.handle} />

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
          {/* ── Hero ── */}
          <View style={detailStyles.heroSection}>
            <AvatarCircle profile={profile} size={96} />

            {isMe && (
              <View style={[detailStyles.meBadge, { marginTop: spacing.xs }]}>
                <Text style={detailStyles.meBadgeText}>Você</Text>
              </View>
            )}

            <Text style={detailStyles.heroName}>{profile.nome}</Text>

            {profile.especialidade ? (
              <View style={detailStyles.specialtyChip}>
                <Text style={detailStyles.specialtyText}>{profile.especialidade}</Text>
              </View>
            ) : null}

            {/* Indicado por (badge dourado no hero) */}
            {referidoPor && (
              <View style={detailStyles.referralHero}>
                <Ionicons name="link-outline" size={13} color={colors.oliGold} />
                <Text style={detailStyles.referralHeroText}>
                  Indicado por {referidoPor.nome}
                </Text>
              </View>
            )}
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
              icon="calendar-outline"
              label="Membro desde"
              value={memberSince}
            />
            <InfoRow
              icon="star-outline"
              label="Plano"
              value={planLabel}
              isLast={tiposAtend.length === 0 && convenios.length === 0}
            />

            {/* Tipos de atendimento */}
            {tiposAtend.length > 0 && (
              <View style={[detailStyles.infoRow, detailStyles.infoRowBorder]}>
                <View style={detailStyles.infoIconWrap}>
                  <Ionicons name="clipboard-outline" size={16} color={colors.oliGreen} />
                </View>
                <Text style={detailStyles.infoLabel}>Atendimento</Text>
                <View style={detailStyles.chipGroup}>
                  {tiposAtend.map(t => (
                    <View key={t} style={detailStyles.infoChip}>
                      <Text style={detailStyles.infoChipText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Convênios */}
            {convenios.length > 0 && (
              <View style={detailStyles.infoRow}>
                <View style={detailStyles.infoIconWrap}>
                  <Ionicons name="card-outline" size={16} color={colors.oliGreen} />
                </View>
                <Text style={detailStyles.infoLabel}>Convênios</Text>
                <View style={detailStyles.chipGroup}>
                  {convenios.map(c => (
                    <View key={c} style={detailStyles.infoChip}>
                      <Text style={detailStyles.infoChipText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* ── Conexão ── */}
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
  const [profiles,        setProfiles]        = useState<Profile[]>([]);
  const [query,           setQuery]           = useState('');
  const [refreshing,      setRefreshing]      = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

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

  // Índice de perfis por ID para resolver referências de indicação
  const profileById = Object.fromEntries(profiles.map(p => [p.id, p]));

  const filtered = profiles.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    const tiposAtend = ((p as any).tipos_atendimento as string[] | undefined) ?? [];
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.especialidade?.toLowerCase().includes(q) ?? false) ||
      tiposAtend.some(t => t.toLowerCase().includes(q))
    );
  });

  const selectedReferidoPor = selectedProfile
    ? (profileById[(selectedProfile as any).referido_por] ?? null)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfessionalDetailModal
        profile={selectedProfile}
        isMe={selectedProfile?.id === session?.user?.id}
        referidoPor={selectedReferidoPor}
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
          placeholder="Buscar por nome, especialidade ou tipo…"
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
                referidoPor={profileById[(p as any).referido_por] ?? null}
                onPress={() => setSelectedProfile(p)}
              />
            ))}
          </View>
        )}

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
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.oliDarkGray },
  headerSub:   { fontSize: 13, color: colors.oliLightGray, marginTop: 2 },
  headerIcon:  {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: `${colors.oliGreen}15`,
    justifyContent: 'center', alignItems: 'center',
  },

  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.white,
    borderRadius:      radius.full,
    marginHorizontal:  spacing.md,
    marginBottom:      spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    ...shadows.small,
  },
  searchIcon:  { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, color: colors.oliDarkGray },

  grid: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  row:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  card: {
    width:           CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    alignItems:      'center',
    gap:             4,
  },

  avatarWrap: { position: 'relative', marginBottom: spacing.xs },
  meBadge: {
    position:          'absolute',
    bottom:            -4,
    right:             -4,
    backgroundColor:   colors.oliGreen,
    borderRadius:      radius.full,
    paddingHorizontal: 6,
    paddingVertical:   1,
    borderWidth:       2,
    borderColor:       colors.white,
  },
  meBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white },

  nome: { fontSize: 14, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center' },

  specialtyChip: {
    backgroundColor:   `${colors.oliGreen}15`,
    borderRadius:      radius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
    maxWidth:          '100%',
  },
  specialtyChipEmpty: { backgroundColor: `${colors.gray}10` },
  specialtyText: { fontSize: 11, fontWeight: '600', color: colors.oliGreen, textAlign: 'center' },

  bio: { fontSize: 12, color: colors.gray, textAlign: 'center', lineHeight: 17 },

  tagRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  tagChip: {
    backgroundColor:   `${colors.oliGreen}10`,
    borderRadius:      radius.full,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  tagText: { fontSize: 10, color: colors.oliGreen, fontWeight: '600' },

  referralBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    backgroundColor:   `${colors.oliGold}12`,
    borderRadius:      radius.full,
    paddingHorizontal: 7,
    paddingVertical:   2,
    marginTop:         2,
  },
  referralText: { fontSize: 10, color: colors.oliGold, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm, width: '100%' },
  emptyText: { fontSize: 14, color: colors.oliLightGray, textAlign: 'center' },

  syncNote: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing.xs,
    marginTop:         spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  syncNoteText: { fontSize: 12, color: colors.gray, flex: 1, lineHeight: 17 },
});

// ─── Detail Modal Styles ──────────────────────────────────────────────────────

const detailStyles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.oliBackground },
  handle: {
    width: 40, height: 4,
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
  scroll: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },

  heroSection: {
    alignItems:    'center',
    paddingTop:    spacing.xl,
    paddingBottom: spacing.lg,
    gap:           spacing.xs,
  },
  meBadge: {
    backgroundColor:   colors.oliGreen,
    borderRadius:      radius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
  },
  meBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white },
  heroName: {
    fontSize:   22,
    fontWeight: '700',
    color:      colors.oliDarkGray,
    textAlign:  'center',
    marginTop:  spacing.xs,
  },
  specialtyChip: {
    backgroundColor:   `${colors.oliGreen}18`,
    borderRadius:      radius.full,
    paddingHorizontal: 14,
    paddingVertical:   4,
  },
  specialtyText: { fontSize: 13, fontWeight: '600', color: colors.oliGreen },

  referralHero: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   `${colors.oliGold}15`,
    borderRadius:      radius.full,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  referralHeroText: { fontSize: 12, color: colors.oliGold, fontWeight: '600' },

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
    fontSize:      11,
    fontWeight:    '700',
    color:         colors.oliLightGray,
    letterSpacing: 0.8,
  },

  bioText: { fontSize: 14, color: colors.gray, lineHeight: 22 },

  infoRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
    flexWrap:        'wrap',
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
    flexShrink:      0,
  },
  infoLabel: { flex: 1, fontSize: 14, color: colors.gray },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },

  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' },
  infoChip:  {
    backgroundColor:   `${colors.oliGreen}12`,
    borderRadius:      radius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  infoChipText: { fontSize: 11, fontWeight: '600', color: colors.oliGreen },

  connectionNote: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    gap:              spacing.sm,
    backgroundColor:  `${colors.oliGreen}08`,
    borderRadius:     radius.md,
    padding:          spacing.md,
  },
  connectionNoteText: { flex: 1, fontSize: 13, color: colors.gray, lineHeight: 19 },
});
