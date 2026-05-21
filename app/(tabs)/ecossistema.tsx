import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Modal, Image, Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/appStore';
import { contactReception } from '../../src/utils/whatsapp';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import { lumaService, type LumaEvent } from '../../src/services/luma';

// Cores de capa para eventos sem imagem (alterna por índice)
const EVENT_COVER_COLORS = ['#4A7C59', '#B8893C', '#5B7FA6', '#7B6EA8'];

export default function EcossistemaScreen() {
  const { userPlan } = useAppStore();
  const router = useRouter();
  const [showBenefits, setShowBenefits] = useState(false);
  const [events,       setEvents]       = useState<LumaEvent[]>([]);
  const [loadingEvts,  setLoadingEvts]  = useState(true);
  const [showPastEvts, setShowPastEvts] = useState(false);

  useEffect(() => {
    lumaService.getUpcomingEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvts(false));
  }, []);

  const handleWhatsApp = async () => { await contactReception(); };

  const handleUpgradeRequest = () => {
    setShowBenefits(false);
    Alert.alert(
      'Solicitação Enviada',
      'Nossa equipe entrará em contato para processar seu upgrade via Communicare.',
    );
  };

  const handleOpenEvent = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Erro', 'Não foi possível abrir o evento. Acesse lu.ma pelo navegador.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Botão WhatsApp Recepção ── */}
        <TouchableOpacity
          style={styles.receptionBtn}
          onPress={handleWhatsApp}
          accessibilityLabel="Falar com a recepção do OLI via WhatsApp"
        >
          <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
          <Text style={styles.receptionBtnText}>Falar com a Recepção</Text>
        </TouchableOpacity>

        {/* ── Meu Plano ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.planHeader}>
            <Text style={styles.sectionTitle}>Meu Plano</Text>
            <TouchableOpacity
              onPress={() => setShowBenefits(true)}
              accessibilityLabel="Ver benefícios e opções de upgrade"
            >
              <Text style={styles.upgradeLink}>Ver benefícios</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.planRow}>
            <Text style={styles.planName}>{userPlan}</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Ativo</Text>
            </View>
          </View>
          <Text style={styles.planDesc}>
            Acesso à infraestrutura premium, recepção assistida e agendamento online.
          </Text>
          {userPlan !== 'VIP' && (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => setShowBenefits(true)}
              accessibilityLabel="Fazer upgrade do plano"
            >
              <Ionicons name="arrow-up-circle-outline" size={15} color={colors.oliGold} />
              <Text style={styles.upgradeBtnText}>
                {userPlan === 'BASE' ? 'Fazer Upgrade para PRO ou VIP' : 'Fazer Upgrade para VIP'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Uso do plano ── */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>
          Uso do Plano
        </Text>

        <View style={[styles.card, shadows.card]}>
          <PacoteHoras consumed={12} total={20} />
          <View style={styles.serviceDivider} />
          <ServiceBar title="Orientações Jurídicas" consumed={1} total={3} unit="consultas" />
          <ServiceBar title="Eventos OLI"           consumed={0} total={1} unit="evento" />
        </View>

        {/* ── Especialistas OLI ── */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>
          Especialistas OLI
        </Text>
        <Text style={[styles.sectionDesc, { paddingHorizontal: spacing.md }]}>
          Tire suas dúvidas com nossa IA especializada ou agende uma consulta diretamente com o especialista.
        </Text>

        <View style={[styles.card, shadows.card]}>
          <AgentCard
            avatar="A"
            photo={require('../../assets/images/agentes/ana-luiza.jpg')}
            color={colors.oliGreen}
            title="Ana Luiza"
            role="Direito Médico"
            subtitle="CFM, LGPD, contratos e ética médica"
            onPress={() => router.push('/chatbot?persona=ana')}
          />
          <View style={styles.agentDivider} />
          <AgentCard
            avatar="I"
            photo={require('../../assets/images/agentes/isabella.jpg')}
            color={colors.oliGold}
            title="Isabella"
            role="Contabilidade Médica"
            subtitle="Impostos, PJ médica, nota fiscal e pró-labore"
            onPress={() => router.push('/chatbot?persona=isabella')}
          />
          <View style={styles.agentDivider} />
          <AgentCard
            avatar="A"
            color="#C0714A"
            title="Amanda"
            role="OLI Convênios"
            subtitle="Credenciamento, faturamento TISS e glosas"
            onPress={() => router.push('/chatbot?persona=convenios')}
          />
          <View style={styles.agentDivider} />
          <AgentCard
            avatar="R"
            color="#7B6EA8"
            title="Ronaldo"
            role="OLI Carreira"
            subtitle="Posicionamento, captação e gestão de no-show"
            onPress={() => router.push('/chatbot?persona=carreira')}
          />
          <View style={styles.agentDivider} />
          <AgentCard
            avatar="O"
            color="#7B9E82"
            title="Olivia"
            role="OLI Health Hub"
            subtitle="Salas, planos, reservas e eventos"
            onPress={() => router.push('/chatbot?persona=olivia')}
          />
        </View>

        {/* ── Eventos Luma ── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>
            Eventos OLI
          </Text>
          <TouchableOpacity
            onPress={() => handleOpenEvent('https://lu.ma/oli')}
            accessibilityLabel="Ver todos os eventos no Luma"
            style={{ paddingHorizontal: spacing.md }}
          >
            <Text style={styles.seeAllLink}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {loadingEvts ? (
          <View style={eventStyles.loading}>
            <ActivityIndicator color={colors.oliGreen} />
            <Text style={eventStyles.loadingText}>Carregando eventos…</Text>
          </View>
        ) : (() => {
          const now          = Date.now();
          const upcoming     = events.filter(e => new Date(e.endAt).getTime() >= now);
          const past         = events.filter(e => new Date(e.endAt).getTime() <  now);

          return (
            <>
              {/* Próximos eventos */}
              {upcoming.length === 0 ? (
                <View style={[styles.card, shadows.card, eventStyles.emptyCard]}>
                  <Ionicons name="calendar-outline" size={32} color={colors.gray} />
                  <Text style={eventStyles.emptyText}>Nenhum evento programado no momento.</Text>
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

              {/* Eventos passados (seção recolhida) */}
              {past.length > 0 && (
                <>
                  <TouchableOpacity
                    style={eventStyles.pastToggle}
                    onPress={() => setShowPastEvts(v => !v)}
                    accessibilityLabel={showPastEvts ? 'Recolher eventos passados' : 'Ver eventos passados'}
                  >
                    <Ionicons
                      name={showPastEvts ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.oliLightGray}
                    />
                    <Text style={eventStyles.pastToggleText}>
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

      {/* ── Modal Benefícios / Upgrade ── */}
      <Modal visible={showBenefits} animationType="slide" presentationStyle="pageSheet">
        <PlanBenefitsModal
          currentPlan={userPlan}
          onUpgrade={handleUpgradeRequest}
          onClose={() => setShowBenefits(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({
  event, accentColor, onPress, isPast = false,
}: { event: LumaEvent; accentColor: string; onPress: () => void; isPast?: boolean }) {
  const start     = new Date(event.startAt);
  const end       = new Date(event.endAt);
  const dateLabel = start.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeLabel = `${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const daysUntil = Math.ceil((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const countdownLabel = isPast ? 'Encerrado' :
    daysUntil === 0 ? 'Hoje' :
    daysUntil === 1 ? 'Amanhã' :
    `Em ${daysUntil} dias`;

  return (
    <TouchableOpacity
      style={[eventStyles.card, shadows.card, isPast && eventStyles.cardPast]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Evento ${event.title}. ${countdownLabel}. Toque para abrir no Luma.`}
    >
      {/* Capa colorida */}
      <View style={[eventStyles.cover, { backgroundColor: accentColor }]}>
        {event.coverUrl ? (
          <Image source={{ uri: event.coverUrl }} style={eventStyles.coverImage} />
        ) : (
          <View style={eventStyles.coverPlaceholder}>
            <Ionicons name="calendar" size={32} color="rgba(255,255,255,0.6)" />
            <Text style={eventStyles.coverTitle} numberOfLines={2}>{event.title}</Text>
          </View>
        )}
        {/* Badges sobre a capa */}
        <View style={eventStyles.coverBadges}>
          <View style={eventStyles.countdownBadge}>
            <Text style={eventStyles.countdownText}>{countdownLabel}</Text>
          </View>
          {event.isFree && (
            <View style={eventStyles.freeBadge}>
              <Text style={eventStyles.freeBadgeText}>Gratuito</Text>
            </View>
          )}
        </View>
      </View>

      {/* Corpo */}
      <View style={eventStyles.body}>
        <Text style={eventStyles.title} numberOfLines={2}>{event.title}</Text>

        <View style={eventStyles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.gray} />
          <Text style={eventStyles.meta}>{dateLabel} · {timeLabel}</Text>
        </View>
        <View style={eventStyles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.gray} />
          <Text style={eventStyles.meta} numberOfLines={1}>{event.location}</Text>
        </View>
        <View style={eventStyles.metaRow}>
          <Ionicons name="people-outline" size={13} color={colors.gray} />
          <Text style={eventStyles.meta}>{event.guestCount} confirmados</Text>
        </View>

        {/* Tags */}
        {event.tags.length > 0 && (
          <View style={eventStyles.tags}>
            {event.tags.map(tag => (
              <View key={tag} style={[eventStyles.tag, { borderColor: accentColor }]}>
                <Text style={[eventStyles.tagText, { color: accentColor }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {!isPast && (
          <TouchableOpacity
            style={[eventStyles.cta, { backgroundColor: accentColor }]}
            onPress={onPress}
            accessibilityLabel={`Inscrever-se em ${event.title}`}
          >
            <Text style={eventStyles.ctaText}>Abrir no Luma</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const eventStyles = StyleSheet.create({
  loading:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, justifyContent: 'center' },
  loadingText:  { fontSize: 14, color: colors.gray },
  emptyCard:    { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText:    { fontSize: 14, color: colors.gray, textAlign: 'center' },

  card:     { backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden' },
  cardPast: { opacity: 0.55 },

  pastToggle: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    paddingVertical: spacing.sm,
  },
  pastToggleText: { fontSize: 13, fontWeight: '600', color: colors.oliLightGray },
  cover:  { height: 120, justifyContent: 'flex-end' },
  coverImage:       { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  coverPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', padding: spacing.md, gap: 8 },
  coverTitle:       { fontSize: 16, fontWeight: '700', color: colors.white, lineHeight: 22, maxWidth: '80%' },
  coverBadges:      { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm },
  countdownBadge:   { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  countdownText:    { fontSize: 12, fontWeight: '700', color: colors.white },
  freeBadge:        { backgroundColor: `${colors.oliGreen}DD`, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  freeBadgeText:    { fontSize: 12, fontWeight: '700', color: colors.white },

  body:    { padding: spacing.md, gap: 6 },
  title:   { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray, lineHeight: 22, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta:    { fontSize: 13, color: colors.gray, flex: 1 },

  tags:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  tag:     { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '600' },

  cta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: 10, marginTop: spacing.xs },
  ctaText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});

// ── OLISolutionCard ───────────────────────────────────────────────────────────

function OLISolutionCard({
  accent, icon, title, description, ctaLabel, onPress, disabled = false,
}: {
  accent:      string;
  icon:        string;
  title:       string;
  description: string;
  ctaLabel:    string;
  onPress?:    () => void;
  disabled?:   boolean;
}) {
  return (
    <View style={[solutionStyles.card, shadows.small]}>
      <View style={[solutionStyles.accentBar, { backgroundColor: accent }]} />
      <View style={solutionStyles.body}>
        <View style={solutionStyles.headerRow}>
          <View style={[solutionStyles.iconWrap, { backgroundColor: `${accent}18` }]}>
            <Ionicons name={icon as any} size={20} color={accent} />
          </View>
          <Text style={solutionStyles.title}>{title}</Text>
          {disabled && (
            <View style={solutionStyles.badge}>
              <Text style={solutionStyles.badgeText}>Em breve</Text>
            </View>
          )}
        </View>
        <Text style={solutionStyles.description}>{description}</Text>
        <TouchableOpacity
          style={[solutionStyles.cta, disabled && solutionStyles.ctaDisabled, { borderColor: accent }]}
          onPress={onPress}
          disabled={disabled}
          accessibilityLabel={ctaLabel}
        >
          <Text style={[solutionStyles.ctaText, disabled && solutionStyles.ctaTextDisabled, { color: disabled ? colors.gray : accent }]}>
            {ctaLabel}
          </Text>
          {!disabled && <Ionicons name="arrow-forward" size={14} color={accent} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const solutionStyles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    overflow:        'hidden',
  },
  accentBar: { width: 4 },
  body:      { flex: 1, padding: spacing.md, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap:  {
    width:          34,
    height:         34,
    borderRadius:   radius.sm,
    justifyContent: 'center',
    alignItems:     'center',
    flexShrink:     0,
  },
  title:    { flex: 1, fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  badge:    { backgroundColor: `${colors.gray}20`, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:{ fontSize: 11, fontWeight: '600', color: colors.gray },
  description: { fontSize: 13, color: colors.gray, lineHeight: 18 },
  cta: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    alignSelf:       'flex-start',
    borderWidth:     1.5,
    borderRadius:    radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop:       2,
  },
  ctaDisabled:     { borderColor: colors.border },
  ctaText:         { fontSize: 13, fontWeight: '700' },
  ctaTextDisabled: { color: colors.gray },
});

// ── AgentCard ─────────────────────────────────────────────────────────────────

function AgentCard({
  avatar, photo, color, title, role, subtitle, onPress,
}: {
  avatar:   string;
  photo?:   ReturnType<typeof require>;
  color:    string;
  title:    string;
  role:     string;
  subtitle: string;
  onPress:  () => void;
}) {
  return (
    <TouchableOpacity
      style={agentStyles.row}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel={`Consultar ${title} — ${role}`}
    >
      {/* Foto / avatar */}
      <View style={[agentStyles.avatar, { backgroundColor: color }]}>
        {photo ? (
          <Image source={photo} style={agentStyles.photo} />
        ) : (
          <Text style={agentStyles.avatarText}>{avatar}</Text>
        )}
      </View>

      {/* Info */}
      <View style={agentStyles.info}>
        <View style={agentStyles.nameRow}>
          <Text style={agentStyles.name}>{title}</Text>
          <View style={[agentStyles.roleBadge, { backgroundColor: `${color}18` }]}>
            <Text style={[agentStyles.roleText, { color }]}>{role}</Text>
          </View>
        </View>
        <Text style={agentStyles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>

      {/* CTA */}
      <View style={[agentStyles.chatBtn, { backgroundColor: `${color}15` }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={color} />
      </View>
    </TouchableOpacity>
  );
}

const agentStyles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, paddingHorizontal: spacing.md },
  avatar:     { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' },
  photo:      { width: 50, height: 50, borderRadius: 25 },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  info:       { flex: 1, gap: 4 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  name:       { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  roleBadge:  { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  roleText:   { fontSize: 11, fontWeight: '700' },
  subtitle:   { fontSize: 12, color: colors.gray },
  chatBtn:    { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
});

// ── PacoteHoras ───────────────────────────────────────────────────────────────

function PacoteHoras({ consumed, total }: { consumed: number; total: number }) {
  const remaining = total - consumed;
  const progress  = total > 0 ? consumed / total : 0;
  const isLow     = remaining <= total * 0.2;          // últimos 20%

  return (
    <View style={pacoteStyles.container}>
      <View style={pacoteStyles.header}>
        <View style={pacoteStyles.titleRow}>
          <Ionicons name="time-outline" size={15} color={colors.oliGreen} />
          <Text style={pacoteStyles.title}>Pacote {total}h</Text>
        </View>
        <TouchableOpacity accessibilityLabel="Comprar mais horas">
          <Text style={pacoteStyles.addMore}>+ Comprar horas</Text>
        </TouchableOpacity>
      </View>

      <View style={pacoteStyles.track}>
        <View style={[
          pacoteStyles.fill,
          { width: `${Math.min(progress * 100, 100)}%` },
          isLow && pacoteStyles.fillLow,
        ]} />
      </View>

      <View style={pacoteStyles.stats}>
        <View style={pacoteStyles.statItem}>
          <Text style={pacoteStyles.statValue}>{consumed}h</Text>
          <Text style={pacoteStyles.statLabel}>utilizadas</Text>
        </View>
        <View style={pacoteStyles.statDivider} />
        <View style={pacoteStyles.statItem}>
          <Text style={[pacoteStyles.statValue, isLow && { color: colors.oliRed }]}>
            {remaining}h
          </Text>
          <Text style={pacoteStyles.statLabel}>restantes</Text>
        </View>
        <View style={pacoteStyles.statDivider} />
        <View style={pacoteStyles.statItem}>
          <Text style={pacoteStyles.statValue}>{total}h</Text>
          <Text style={pacoteStyles.statLabel}>contratadas</Text>
        </View>
      </View>
    </View>
  );
}

const pacoteStyles = StyleSheet.create({
  container:   { paddingBottom: spacing.md },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title:       { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  addMore:     { fontSize: 13, fontWeight: '700', color: colors.oliGold },
  track:       { height: 8, backgroundColor: `${colors.oliGreen}1A`, borderRadius: radius.full, overflow: 'hidden', marginBottom: spacing.sm },
  fill:        { height: 8, backgroundColor: colors.oliGreen, borderRadius: radius.full },
  fillLow:     { backgroundColor: colors.oliRed },
  stats:       { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem:    { alignItems: 'center', flex: 1 },
  statValue:   { fontSize: 20, fontWeight: '700', color: colors.oliGreen },
  statLabel:   { fontSize: 11, color: colors.gray, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
});

// ── ServiceBar ────────────────────────────────────────────────────────────────

function ServiceBar({
  title, consumed, total, unit,
}: { title: string; consumed: number; total: number; unit: string }) {
  const progress = total > 0 ? consumed / total : 0;
  return (
    <View style={barStyles.container}>
      <View style={barStyles.row}>
        <Text style={barStyles.title}>{title}</Text>
        <Text style={barStyles.count}>{consumed}/{total} {unit}</Text>
      </View>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  row:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  title:     { fontSize: 14, fontWeight: '500', color: colors.oliDarkGray },
  count:     { fontSize: 14, fontWeight: '700', color: colors.oliGreen },
  track:     { height: 6, backgroundColor: `${colors.oliGreen}1A`, borderRadius: radius.full, overflow: 'hidden' },
  fill:      { height: 6, backgroundColor: colors.oliGreen, borderRadius: radius.full },
});

// ── PlanBenefitsModal ─────────────────────────────────────────────────────────

type PlanTier = 'BASE' | 'PRO' | 'VIP';

interface Benefit {
  category: string;
  icon:     string;
  items:    {
    label:    string;
    base:     string | boolean;
    pro:      string | boolean;
    vip:      string | boolean;
  }[];
}

const PLAN_BENEFITS: Benefit[] = [
  {
    category: 'Infraestrutura',
    icon: 'business-outline',
    items: [
      { label: 'Horas de sala/mês',      base: '10h',    pro: '20h',    vip: '40h' },
      { label: 'Salas disponíveis',       base: 'Básica', pro: 'Todas',  vip: 'Todas + VIP' },
      { label: 'Recepção assistida',      base: true,     pro: true,     vip: true },
      { label: 'Sala exclusiva VIP',      base: false,    pro: false,    vip: true },
    ],
  },
  {
    category: 'Contabilidade · Contábil Mello',
    icon: 'calculator-outline',
    items: [
      { label: 'Declaração IR (PF)',         base: true,       pro: true,        vip: true },
      { label: 'Abertura de PJ Médica',      base: false,      pro: true,        vip: true },
      { label: 'BPO Fiscal mensal',          base: false,      pro: true,        vip: true },
      { label: 'Folha de pagamento',         base: false,      pro: true,        vip: true },
      { label: 'Planejamento tributário',    base: false,      pro: false,       vip: true },
      { label: 'DRE mensal',                 base: false,      pro: false,       vip: true },
      { label: 'Assessoria dedicada',        base: false,      pro: false,       vip: true },
    ],
  },
  {
    category: 'Especialistas IA',
    icon: 'sparkles-outline',
    items: [
      { label: 'Chatbot jurídico (Ana)',         base: true,  pro: true,  vip: true },
      { label: 'Contabilidade (Isabella)',       base: false, pro: true,  vip: true },
      { label: 'Convênios (Amanda)',             base: false, pro: true,  vip: true },
      { label: 'Carreira (Ronaldo)',             base: false, pro: true,  vip: true },
      { label: 'OLI Hub (Olivia)',               base: true,  pro: true,  vip: true },
    ],
  },
  {
    category: 'Assessoria Jurídica',
    icon: 'shield-checkmark-outline',
    items: [
      { label: 'Consultas via IA/mês',     base: '1',          pro: '3',           vip: 'Ilimitada' },
      { label: 'Consulta com advogado',    base: false,        pro: '1/mês',       vip: '2/mês' },
    ],
  },
  {
    category: 'Eventos e Comunidade',
    icon: 'people-outline',
    items: [
      { label: 'Eventos OLI gratuitos',   base: '1/mês',  pro: '2/mês',   vip: 'Ilimitado' },
      { label: 'Workshops exclusivos',    base: false,    pro: false,     vip: true },
      { label: 'Networking com médicos',  base: true,     pro: true,      vip: true },
    ],
  },
  {
    category: 'Suporte',
    icon: 'headset-outline',
    items: [
      { label: 'WhatsApp recepção',       base: 'Comercial', pro: 'Prioritário', vip: 'Prioritário' },
      { label: 'Gerente de conta',        base: false,       pro: false,         vip: true },
    ],
  },
];

const PLAN_COLORS: Record<PlanTier, string> = {
  BASE: colors.gray,
  PRO:  colors.oliGreen,
  VIP:  colors.oliGold,
};

const PLAN_PRICES: Record<PlanTier, string> = {
  BASE: 'R$ 890/mês',
  PRO:  'R$ 1.490/mês',
  VIP:  'R$ 2.490/mês',
};

function BenefitValue({ value, planColor }: { value: string | boolean; planColor: string }) {
  if (value === false) {
    return <Ionicons name="lock-closed" size={15} color={`${colors.gray}60`} />;
  }
  if (value === true) {
    return <Ionicons name="checkmark-circle" size={17} color={planColor} />;
  }
  return (
    <Text style={[benefitStyles.valueText, { color: planColor }]}>{value}</Text>
  );
}

function PlanBenefitsModal({
  currentPlan, onUpgrade, onClose,
}: { currentPlan: PlanTier; onUpgrade: () => void; onClose: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(currentPlan);
  const isCurrentPlan = selectedPlan === currentPlan;
  const canUpgrade    = (
    (currentPlan === 'BASE' && (selectedPlan === 'PRO' || selectedPlan === 'VIP')) ||
    (currentPlan === 'PRO'  && selectedPlan === 'VIP')
  );

  const planColor = PLAN_COLORS[selectedPlan];

  return (
    <SafeAreaView style={benefitStyles.safe}>
      {/* Header */}
      <View style={benefitStyles.header}>
        <Text style={benefitStyles.headerTitle}>Planos OLI Health Hub</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar">
          <Ionicons name="close" size={24} color={colors.oliDarkGray} />
        </TouchableOpacity>
      </View>

      {/* Seletor de plano */}
      <View style={benefitStyles.planSelector}>
        {(['BASE', 'PRO', 'VIP'] as PlanTier[]).map(plan => {
          const active = selectedPlan === plan;
          const isCurrent = plan === currentPlan;
          return (
            <TouchableOpacity
              key={plan}
              style={[
                benefitStyles.planTab,
                active && { backgroundColor: PLAN_COLORS[plan], borderColor: PLAN_COLORS[plan] },
                !active && { borderColor: `${PLAN_COLORS[plan]}40` },
              ]}
              onPress={() => setSelectedPlan(plan)}
              accessibilityLabel={`Plano ${plan}${isCurrent ? ' (seu plano atual)' : ''}`}
            >
              <Text style={[
                benefitStyles.planTabText,
                active  && { color: colors.white },
                !active && { color: PLAN_COLORS[plan] },
              ]}>
                {plan}
              </Text>
              {isCurrent && (
                <View style={[benefitStyles.currentDot, { backgroundColor: active ? colors.white : PLAN_COLORS[plan] }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Preço */}
      <View style={[benefitStyles.priceRow, { borderColor: `${planColor}30` }]}>
        <Text style={[benefitStyles.price, { color: planColor }]}>{PLAN_PRICES[selectedPlan]}</Text>
        {isCurrentPlan && (
          <View style={[benefitStyles.activePill, { backgroundColor: `${planColor}18` }]}>
            <Ionicons name="checkmark-circle" size={13} color={planColor} />
            <Text style={[benefitStyles.activePillText, { color: planColor }]}>Plano atual</Text>
          </View>
        )}
      </View>

      {/* Lista de benefícios */}
      <ScrollView contentContainerStyle={benefitStyles.list} showsVerticalScrollIndicator={false}>
        {PLAN_BENEFITS.map(section => (
          <View key={section.category} style={benefitStyles.section}>
            <View style={benefitStyles.sectionHeader}>
              <Ionicons name={section.icon as any} size={16} color={planColor} />
              <Text style={[benefitStyles.sectionTitle, { color: planColor }]}>{section.category}</Text>
            </View>
            {section.items.map(item => {
              const value = item[selectedPlan.toLowerCase() as 'base' | 'pro' | 'vip'];
              const locked = value === false;
              return (
                <View key={item.label} style={[benefitStyles.item, locked && benefitStyles.itemLocked]}>
                  <Text style={[benefitStyles.itemLabel, locked && benefitStyles.itemLabelLocked]}>
                    {item.label}
                  </Text>
                  <BenefitValue value={value} planColor={planColor} />
                </View>
              );
            })}
          </View>
        ))}

        {/* Botão de ação */}
        {canUpgrade ? (
          <TouchableOpacity
            style={[benefitStyles.ctaBtn, { backgroundColor: planColor }]}
            onPress={onUpgrade}
            accessibilityLabel={`Solicitar upgrade para o plano ${selectedPlan}`}
          >
            <Ionicons name="arrow-up-circle" size={18} color={colors.white} />
            <Text style={benefitStyles.ctaBtnText}>Solicitar Upgrade para {selectedPlan}</Text>
          </TouchableOpacity>
        ) : isCurrentPlan ? (
          <View style={benefitStyles.currentNotice}>
            <Ionicons name="checkmark-circle" size={16} color={colors.oliGreen} />
            <Text style={benefitStyles.currentNoticeText}>Você já está neste plano</Text>
          </View>
        ) : null}

        <Text style={benefitStyles.footnote}>
          * Upgrade processado pela recepção OLI via Communicare. Entre em contato pelo WhatsApp para mais informações.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const benefitStyles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.oliBackground },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },

  planSelector: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  planTab:      {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1.5, position: 'relative',
  },
  planTabText:  { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  currentDot:   { width: 5, height: 5, borderRadius: 3, position: 'absolute', bottom: 5 },

  priceRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1 },
  price:       { fontSize: 20, fontWeight: '800' },
  activePill:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  activePillText: { fontSize: 12, fontWeight: '700' },

  list:        { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 40, gap: spacing.sm },

  section:      { backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden' },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.md, paddingBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

  item:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: colors.border },
  itemLocked:     { backgroundColor: `${colors.gray}06` },
  itemLabel:      { fontSize: 14, color: colors.oliDarkGray, flex: 1, paddingRight: spacing.sm },
  itemLabelLocked:{ color: `${colors.gray}80` },

  valueText: { fontSize: 13, fontWeight: '700' },

  ctaBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.md },
  ctaBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  currentNotice:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.md },
  currentNoticeText: { fontSize: 14, color: colors.oliGreen, fontWeight: '600' },

  footnote: { fontSize: 11, color: `${colors.gray}90`, textAlign: 'center', lineHeight: 16, marginTop: spacing.sm },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },

  receptionBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  receptionBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
  },
  sectionRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAllLink:     { fontSize: 13, fontWeight: '600', color: colors.oliGold },
  planHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:   { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  upgradeLink:    { fontSize: 14, fontWeight: '700', color: colors.oliGold },
  planRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  planName:       { fontSize: 24, fontWeight: '700', color: colors.oliGreen },
  activeBadge:    { backgroundColor: colors.oliGreen, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText:{ color: colors.white, fontSize: 12, fontWeight: '700' },
  planDesc:       { fontSize: 14, color: colors.gray, lineHeight: 20 },
  upgradeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  upgradeBtnText: { fontSize: 13, fontWeight: '700', color: colors.oliGold },
  agentDivider:   { height: 0.5, backgroundColor: colors.border, marginHorizontal: spacing.md },
  sectionDesc:    { fontSize: 13, color: colors.gray, lineHeight: 18, marginTop: -spacing.xs },
  serviceDivider: { height: 0.5, backgroundColor: colors.border, marginBottom: spacing.md },
});
