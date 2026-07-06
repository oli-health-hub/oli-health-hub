import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Modal, Image, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { supabase } from '../../src/services/supabase';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import type { Profile } from '../../src/services/auth';
import { lumaService, type LumaEvent } from '../../src/services/luma';
import { ScrollMoreIndicator } from '../../src/components/ScrollMoreIndicator';

const EVENT_COVER_COLORS = ['#4A7C59', '#B8893C', '#5B7FA6', '#7B6EA8'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(nome: string): string {
  const parts = nome.trim().split(' ').filter(w => w.length > 1);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

function displayName(profile: Profile): string {
  const t = profile.tratamento;
  // Não duplicar tratamento se o nome já começa com "Dr"/"Dra".
  const nomeJaTemTratamento = /^\s*dra?\.?\s/i.test(profile.nome ?? '');
  return t && !nomeJaTemTratamento ? `${t} ${profile.nome}` : profile.nome;
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

// Badge config por plano
const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  START: { label: 'START', color: '#9E9E9E' },
  BASE:  { label: 'BASE',  color: colors.oliGreen },
  PRO:   { label: 'PRO',   color: colors.oliGold },
  VIP:   { label: 'VIP',   color: '#7B6EA8' },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function AvatarCircle({ profile, size }: { profile: Profile; size: number }) {
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
  profile, isMe, referidoPor, onPress,
}: {
  profile: Profile; isMe: boolean; referidoPor: Profile | null; onPress: () => void;
}) {
  const plan        = profile.plan ?? 'START';
  const planBadge   = PLAN_BADGE[plan] ?? PLAN_BADGE.START;
  const isSpeaker   = (profile as Profile & { is_speaker?: boolean }).is_speaker === true;
  const npsScore    = (profile as Profile & { nps_score?: number | null }).nps_score;
  const isTopRated  = typeof npsScore === 'number' && npsScore >= 8.5;

  return (
    <TouchableOpacity
      style={[styles.card, shadows.small]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Ver perfil de ${displayName(profile)}`}
    >
      {/* ── Badges de gamificação (acima do avatar) ── */}
      <View style={styles.badgeRow}>
        {/* Plano */}
        <View style={[styles.planBadge, { backgroundColor: `${planBadge.color}18`, borderColor: `${planBadge.color}40` }]}>
          <Text style={[styles.planBadgeText, { color: planBadge.color }]}>{planBadge.label}</Text>
        </View>

        {/* Palestrante */}
        {isSpeaker && (
          <View style={styles.speakerBadge}>
            <Ionicons name="mic" size={10} color={colors.oliGold} />
            <Text style={styles.speakerBadgeText}>Palestrante</Text>
          </View>
        )}

        {/* NPS alto */}
        {isTopRated && (
          <View style={styles.topRatedBadge}>
            <Ionicons name="star" size={10} color="#FFA500" />
            <Text style={styles.topRatedBadgeText}>Top</Text>
          </View>
        )}
      </View>

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <AvatarCircle profile={profile} size={56} />
        {isMe && (
          <View style={styles.meBadge}>
            <Text style={styles.meBadgeText}>Você</Text>
          </View>
        )}
      </View>

      {/* Nome com tratamento */}
      <Text style={styles.nome} numberOfLines={1}>{displayName(profile)}</Text>

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
  profile, isMe, referidoPor, onClose,
}: {
  profile: Profile | null; isMe: boolean; referidoPor: Profile | null; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!profile) return null;

  const plan        = profile.plan ?? 'START';
  const planBadge   = PLAN_BADGE[plan] ?? PLAN_BADGE.START;
  const isSpeaker   = (profile as Profile & { is_speaker?: boolean }).is_speaker === true;
  const npsScore    = (profile as Profile & { nps_score?: number | null }).nps_score;
  const isTopRated  = typeof npsScore === 'number' && npsScore >= 8.5;
  const instagram   = (profile as Profile & { instagram?: string | null }).instagram;
  const linkedin    = (profile as Profile & { linkedin?: string | null }).linkedin;
  const website     = (profile as Profile & { website?: string | null }).website;
  const tiposAtend  = (profile as Profile & { tipos_atendimento?: string[] }).tipos_atendimento ?? [];
  const convenios   = (profile as Profile & { convenios?: string[] }).convenios ?? [];

  const memberSince = (() => {
    const d = new Date(profile.created_at);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  })();

  const hasSocialLinks = !!(instagram || linkedin || website);

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => null);
  };

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

        <ScrollView contentContainerStyle={detailStyles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero ── */}
          <View style={detailStyles.heroSection}>
            <AvatarCircle profile={profile} size={96} />

            {isMe && (
              <View style={[detailStyles.meBadge, { marginTop: spacing.xs }]}>
                <Text style={detailStyles.meBadgeText}>Você</Text>
              </View>
            )}

            <Text style={detailStyles.heroName}>{displayName(profile)}</Text>

            {profile.especialidade ? (
              <View style={detailStyles.specialtyChip}>
                <Text style={detailStyles.specialtyText}>{profile.especialidade}</Text>
              </View>
            ) : null}

            {/* Badges no hero */}
            <View style={detailStyles.heroBadgeRow}>
              <View style={[detailStyles.heroPlanBadge, { backgroundColor: `${planBadge.color}18`, borderColor: `${planBadge.color}50` }]}>
                <Text style={[detailStyles.heroPlanBadgeText, { color: planBadge.color }]}>{planBadge.label}</Text>
              </View>

              {isSpeaker && (
                <View style={detailStyles.heroSpeakerBadge}>
                  <Ionicons name="mic" size={12} color={colors.oliGold} />
                  <Text style={detailStyles.heroSpeakerText}>Palestrante OLI</Text>
                </View>
              )}

              {isTopRated && (
                <View style={detailStyles.heroTopBadge}>
                  <Ionicons name="star" size={12} color="#FFA500" />
                  <Text style={detailStyles.heroTopText}>Top Avaliado</Text>
                </View>
              )}
            </View>

            {/* Indicado por */}
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

            <InfoRow icon="calendar-outline" label="Membro desde" value={memberSince} />
            <InfoRow
              icon="star-outline"
              label="Plano"
              value={planBadge.label}
              valueColor={planBadge.color}
              isLast={tiposAtend.length === 0 && convenios.length === 0}
            />

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

          {/* ── Redes Sociais ── (só exibe se houver ao menos uma) */}
          {hasSocialLinks && (
            <View style={[detailStyles.card, shadows.small]}>
              <View style={detailStyles.cardHeader}>
                <Text style={detailStyles.sectionLabel}>REDES SOCIAIS</Text>
                <Ionicons name="share-social-outline" size={16} color={colors.oliGreen} />
              </View>

              {instagram && (
                <TouchableOpacity
                  style={detailStyles.socialRow}
                  onPress={() => openUrl(`https://instagram.com/${instagram}`)}
                  accessibilityLabel={`Ver Instagram de ${profile.nome}`}
                >
                  <View style={[detailStyles.socialIcon, { backgroundColor: '#E1306C15' }]}>
                    <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={detailStyles.socialLabel}>Instagram</Text>
                    <Text style={detailStyles.socialValue}>@{instagram}</Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={colors.gray} />
                </TouchableOpacity>
              )}

              {linkedin && (
                <TouchableOpacity
                  style={[detailStyles.socialRow, (instagram || false) && detailStyles.socialRowBorder]}
                  onPress={() => openUrl(linkedin.startsWith('http') ? linkedin : `https://${linkedin}`)}
                  accessibilityLabel={`Ver LinkedIn de ${profile.nome}`}
                >
                  <View style={[detailStyles.socialIcon, { backgroundColor: '#0A66C215' }]}>
                    <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={detailStyles.socialLabel}>LinkedIn</Text>
                    <Text style={detailStyles.socialValue} numberOfLines={1}>{linkedin}</Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={colors.gray} />
                </TouchableOpacity>
              )}

              {website && (
                <TouchableOpacity
                  style={[detailStyles.socialRow, (instagram || linkedin || false) && detailStyles.socialRowBorder]}
                  onPress={() => openUrl(website.startsWith('http') ? website : `https://${website}`)}
                  accessibilityLabel={`Ver site de ${profile.nome}`}
                >
                  <View style={[detailStyles.socialIcon, { backgroundColor: `${colors.oliGreen}15` }]}>
                    <Ionicons name="globe-outline" size={18} color={colors.oliGreen} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={detailStyles.socialLabel}>Site</Text>
                    <Text style={detailStyles.socialValue} numberOfLines={1}>{website}</Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={colors.gray} />
                </TouchableOpacity>
              )}
            </View>
          )}

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
  icon, label, value, valueColor, isLast,
}: {
  icon: string; label: string; value: string; valueColor?: string; isLast?: boolean;
}) {
  return (
    <View style={[detailStyles.infoRow, !isLast && detailStyles.infoRowBorder]}>
      <View style={detailStyles.infoIconWrap}>
        <Ionicons name={icon as 'star-outline'} size={16} color={colors.oliGreen} />
      </View>
      <Text style={detailStyles.infoLabel}>{label}</Text>
      <Text style={[detailStyles.infoValue, valueColor ? { color: valueColor, fontWeight: '700' } : undefined]}>{value}</Text>
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
  const [events,          setEvents]          = useState<LumaEvent[]>([]);
  const [loadingEvts,     setLoadingEvts]     = useState(true);
  const [showPastEvts,    setShowPastEvts]    = useState(false);
  const [showScrollHint,  setShowScrollHint]  = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      // Não exibe quem foi excluído/banido/suspenso (null = legado, mantém visível)
      .not('account_status', 'in', '("deleted","banned","suspended")')
      // Não exibe quem foi banido especificamente da comunidade
      .or('comunidade_banned.is.null,comunidade_banned.eq.false')
      .order('nome');
    if (data) setProfiles(data as Profile[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    lumaService.getUpcomingEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvts(false));
  }, []);

  const handleOpenEvent = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Erro', 'Não foi possível abrir o evento. Acesse lu.ma pelo navegador.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const profileById = Object.fromEntries(profiles.map(p => [p.id, p]));

  const filtered = profiles.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    const tiposAtend = (p as Profile & { tipos_atendimento?: string[] }).tipos_atendimento ?? [];
    return (
      displayName(p).toLowerCase().includes(q) ||
      (p.especialidade?.toLowerCase().includes(q) ?? false) ||
      tiposAtend.some(t => t.toLowerCase().includes(q))
    );
  });

  const selectedReferidoPor = selectedProfile
    ? (profileById[(selectedProfile as Profile & { referido_por?: string }).referido_por ?? ''] ?? null)
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
        scrollEventThrottle={100}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          setShowScrollHint(contentOffset.y + layoutMeasurement.height < contentSize.height - 60);
        }}
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
                referidoPor={profileById[(p as Profile & { referido_por?: string }).referido_por ?? ''] ?? null}
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

        {/* ── Eventos OLI ── */}
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsTitle}>Eventos OLI</Text>
          <TouchableOpacity
            onPress={() => handleOpenEvent('https://lu.ma/oli')}
            accessibilityLabel="Ver todos os eventos no Luma"
          >
            <Text style={styles.eventsSeeAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {loadingEvts ? (
          <View style={styles.eventsLoading}>
            <ActivityIndicator color={colors.oliGreen} />
            <Text style={{ fontSize: 13, color: colors.gray }}>Carregando eventos…</Text>
          </View>
        ) : (() => {
          const now      = Date.now();
          const upcoming = events.filter(e => new Date(e.endAt).getTime() >= now);
          const past     = events.filter(e => new Date(e.endAt).getTime() <  now);
          return (
            <>
              {upcoming.length === 0 ? (
                <View style={[styles.eventsEmpty]}>
                  <Ionicons name="calendar-outline" size={32} color={colors.gray} />
                  <Text style={{ fontSize: 14, color: colors.gray, textAlign: 'center' }}>
                    Nenhum evento programado no momento.
                  </Text>
                </View>
              ) : (
                upcoming.map((evt, i) => (
                  <EventCard
                    key={evt.id}
                    event={evt}
                    accentColor={EVENT_COVER_COLORS[i % EVENT_COVER_COLORS.length]}
                    onPress={() => handleOpenEvent(evt.eventUrl)}
                  />
                ))
              )}

              {past.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.pastToggle}
                    onPress={() => setShowPastEvts(v => !v)}
                    accessibilityLabel={showPastEvts ? 'Recolher eventos passados' : 'Ver eventos passados'}
                  >
                    <Ionicons name={showPastEvts ? 'chevron-up' : 'chevron-down'} size={16} color={colors.oliLightGray} />
                    <Text style={styles.pastToggleText}>
                      {showPastEvts ? 'Ocultar' : 'Ver'} eventos anteriores ({past.length})
                    </Text>
                  </TouchableOpacity>
                  {showPastEvts && past.map((evt, i) => (
                    <EventCard
                      key={evt.id}
                      event={evt}
                      accentColor={`${colors.gray}80`}
                      onPress={() => handleOpenEvent(evt.eventUrl)}
                      isPast
                    />
                  ))}
                </>
              )}
            </>
          );
        })()}
      </ScrollView>

      <ScrollMoreIndicator visible={showScrollHint} />
    </SafeAreaView>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({
  event, accentColor, onPress, isPast = false,
}: { event: LumaEvent; accentColor: string; onPress: () => void; isPast?: boolean }) {
  const start        = new Date(event.startAt);
  const end          = new Date(event.endAt);
  const dateLabel    = start.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeLabel    = `${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const daysUntil    = Math.ceil((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const countdownLabel = isPast ? 'Encerrado' : daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`;

  return (
    <TouchableOpacity
      style={[evtStyles.card, isPast && evtStyles.cardPast]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Evento ${event.title}. ${countdownLabel}. Toque para abrir no Luma.`}
    >
      <View style={[evtStyles.cover, { backgroundColor: accentColor }]}>
        {event.coverUrl ? (
          <Image source={{ uri: event.coverUrl }} style={evtStyles.coverImage} />
        ) : (
          <View style={evtStyles.coverPlaceholder}>
            <Ionicons name="calendar" size={32} color="rgba(255,255,255,0.6)" />
            <Text style={evtStyles.coverTitle} numberOfLines={2}>{event.title}</Text>
          </View>
        )}
        <View style={evtStyles.coverBadges}>
          <View style={evtStyles.countdownBadge}>
            <Text style={evtStyles.countdownText}>{countdownLabel}</Text>
          </View>
          {event.isFree && (
            <View style={evtStyles.freeBadge}>
              <Text style={evtStyles.freeBadgeText}>Gratuito</Text>
            </View>
          )}
        </View>
      </View>

      <View style={evtStyles.body}>
        <Text style={evtStyles.title} numberOfLines={2}>{event.title}</Text>
        <View style={evtStyles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.gray} />
          <Text style={evtStyles.meta}>{dateLabel} · {timeLabel}</Text>
        </View>
        <View style={evtStyles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.gray} />
          <Text style={evtStyles.meta} numberOfLines={1}>{event.location}</Text>
        </View>
        <View style={evtStyles.metaRow}>
          <Ionicons name="people-outline" size={13} color={colors.gray} />
          <Text style={evtStyles.meta}>{event.guestCount} confirmados</Text>
        </View>
        {event.tags.length > 0 && (
          <View style={evtStyles.tags}>
            {event.tags.map(tag => (
              <View key={tag} style={[evtStyles.tag, { borderColor: accentColor }]}>
                <Text style={[evtStyles.tagText, { color: accentColor }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        {!isPast && (
          <TouchableOpacity
            style={[evtStyles.cta, { backgroundColor: accentColor }]}
            onPress={onPress}
            accessibilityLabel={`Inscrever-se em ${event.title}`}
          >
            <Text style={evtStyles.ctaText}>Abrir no Luma</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const evtStyles = StyleSheet.create({
  card:             { backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md },
  cardPast:         { opacity: 0.55 },
  cover:            { height: 120, justifyContent: 'flex-end' },
  coverImage:       { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  coverPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', padding: spacing.md, gap: 8 },
  coverTitle:       { fontSize: 16, fontWeight: '700', color: colors.white, lineHeight: 22, maxWidth: '80%' },
  coverBadges:      { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm },
  countdownBadge:   { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  countdownText:    { fontSize: 12, fontWeight: '700', color: colors.white },
  freeBadge:        { backgroundColor: `${colors.oliGreen}DD`, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  freeBadgeText:    { fontSize: 12, fontWeight: '700', color: colors.white },
  body:             { padding: spacing.md, gap: 6 },
  title:            { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray, lineHeight: 22, marginBottom: 2 },
  metaRow:          { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta:             { fontSize: 13, color: colors.gray, flex: 1 },
  tags:             { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  tag:              { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tagText:          { fontSize: 11, fontWeight: '600' },
  cta:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: 10, marginTop: spacing.xs },
  ctaText:          { color: colors.white, fontSize: 14, fontWeight: '700' },
});

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

  // Badges row (acima do avatar)
  badgeRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            4,
    justifyContent: 'center',
    alignSelf:      'stretch',
    minHeight:      20,
  },
  planBadge: {
    borderRadius:      radius.full,
    borderWidth:       1,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  planBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

  speakerBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               2,
    backgroundColor:   `${colors.oliGold}18`,
    borderRadius:      radius.full,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       `${colors.oliGold}40`,
  },
  speakerBadgeText: { fontSize: 9, fontWeight: '700', color: colors.oliGold },

  topRatedBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               2,
    backgroundColor:   '#FFA50018',
    borderRadius:      radius.full,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       '#FFA50040',
  },
  topRatedBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFA500' },

  avatarWrap: { position: 'relative', marginTop: 4 },
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

  nome: { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center', marginTop: 4 },

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

  // Eventos
  eventsHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },
  eventsTitle:   { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray },
  eventsSeeAll:  { fontSize: 13, fontWeight: '600', color: colors.oliGold },
  eventsLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, justifyContent: 'center' },
  eventsEmpty:   { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.white, borderRadius: radius.lg },
  pastToggle:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  pastToggleText:{ fontSize: 13, fontWeight: '600', color: colors.oliLightGray },
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

  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    justifyContent:'center',
    marginTop:     spacing.xs,
  },
  heroPlanBadge: {
    borderRadius:      radius.full,
    borderWidth:       1,
    paddingHorizontal: 10,
    paddingVertical:   3,
  },
  heroPlanBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  heroSpeakerBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   `${colors.oliGold}15`,
    borderRadius:      radius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       `${colors.oliGold}40`,
  },
  heroSpeakerText: { fontSize: 11, fontWeight: '700', color: colors.oliGold },

  heroTopBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   '#FFA50015',
    borderRadius:      radius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       '#FFA50040',
  },
  heroTopText: { fontSize: 11, fontWeight: '700', color: '#FFA500' },

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
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
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

  chipGroup:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' },
  infoChip:     { backgroundColor: `${colors.oliGreen}12`, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  infoChipText: { fontSize: 11, fontWeight: '600', color: colors.oliGreen },

  // Social links
  socialRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  socialRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  socialIcon: {
    width:          36,
    height:         36,
    borderRadius:   18,
    justifyContent: 'center',
    alignItems:     'center',
    flexShrink:     0,
  },
  socialLabel: { fontSize: 11, color: colors.gray, marginBottom: 1 },
  socialValue: { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray },

  connectionNote: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.sm,
    backgroundColor: `${colors.oliGreen}08`,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  connectionNoteText: { flex: 1, fontSize: 13, color: colors.gray, lineHeight: 19 },
});
