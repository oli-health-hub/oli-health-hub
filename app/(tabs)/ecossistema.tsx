import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/appStore';
import { contactReception } from '../../src/utils/whatsapp';
import { contractModule } from '../../src/utils/moduleContract';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import { useAuthStore } from '../../src/store/authStore';
import { useModuleStore } from '../../src/store/moduleStore';
import { MODULE_CATALOG, isModuleIncludedInPlan, type ModuleId, type OLIModule } from '../../src/models/modules';
import { fetchModulePricing, type ModulePriceOverride } from '../../src/services/moduleService';
import type { PlanType } from '../../src/models/types';
import { FEATURES, type Feature } from '../meu-plano';
import CheckoutModal from '../../src/components/CheckoutModal';
import { ScrollMoreIndicator } from '../../src/components/ScrollMoreIndicator';

// ─── Destaques de benefícios por plano ─────────────────────────────────────────
// Deriva da mesma matriz de `meu-plano.tsx` (fonte única) — mostra o que o
// plano atual desbloqueia em relação ao tier anterior, em vez de repetir uma
// lista fixa que não respeita o plano real do médico.

const PLAN_TIER_ORDER: PlanType[] = ['START', 'BASE', 'PRO', 'VIP'];

function getPlanHighlights(userPlan: PlanType): Feature[] {
  const tierIdx = PLAN_TIER_ORDER.indexOf(userPlan);
  const included = (plan: PlanType) => FEATURES.filter(f => f.plans[plan] === 'yes');

  if (tierIdx <= 0) return included(userPlan).slice(0, 4);

  const prevPlan = PLAN_TIER_ORDER[tierIdx - 1];
  const prevSet  = new Set(included(prevPlan).map(f => f.label));
  const upgrades = included(userPlan).filter(f => !prevSet.has(f.label));

  return (upgrades.length > 0 ? upgrades : included(userPlan)).slice(0, 4);
}

// ─── Cor de destaque por plano (hero do card "Meu Plano") ─────────────────────

const PLAN_COLOR: Record<PlanType, string> = {
  START: colors.oliLightGray,
  BASE:  colors.oliGreen,
  PRO:   colors.oliGold,
  VIP:   colors.oliPurple,
};

// ─── Módulos em destaque (preview — lista completa fica em /modulos) ──────────

const HIGHLIGHT_MODULE_IDS: ModuleId[] = ['communicare', 'contabil_mello', 'scribe_ia'];

function buildModuleLabel(valor: number, tipo: string): string {
  if (tipo === 'incluido') return 'Incluso no plano';
  const fmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  if (tipo === 'mensal') return `${fmt}/mês`;
  if (tipo === 'unico')  return `${fmt} único`;
  return fmt;
}

// ─── Especialistas OLI (todos "em breve" — preview compacto) ──────────────────

const AGENTS = [
  { title: 'Ana Luiza', avatar: 'A', photo: require('../../assets/images/agentes/ana-luiza.jpg'), color: colors.oliGreen },
  { title: 'Isabella',  avatar: 'I', photo: require('../../assets/images/agentes/isabella.jpg'),   color: colors.oliGold },
  { title: 'Amanda',    avatar: 'A', photo: undefined, color: colors.oliCoral },
  { title: 'Ronaldo',   avatar: 'R', photo: undefined, color: colors.oliPurple },
  { title: 'Olivia',    avatar: 'O', photo: undefined, color: '#7B9E82' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────

export default function EcossistemaScreen() {
  const { userPlan } = useAppStore();
  const router = useRouter();
  const [checkoutModule, setCheckoutModule] = useState<OLIModule | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [modulePriceMap, setModulePriceMap] = useState<Map<ModuleId, ModulePriceOverride>>(new Map());

  const user = useAuthStore((s) => s.user);
  const { loadModules, isModuleActive, isLoaded: modulesLoaded } = useModuleStore();

  useEffect(() => {
    if (user?.id) loadModules(user.id, userPlan);
  }, [user?.id, userPlan]);

  useEffect(() => {
    fetchModulePricing()
      .then(overrides => {
        const map = new Map<ModuleId, ModulePriceOverride>();
        overrides.forEach(o => map.set(o.slug, o));
        setModulePriceMap(map);
      })
      .catch(() => {});
  }, []);

  const planHighlights = getPlanHighlights(userPlan);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEventThrottle={100}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          setShowScrollHint(contentOffset.y + layoutMeasurement.height < contentSize.height - 60);
        }}
      >

        {/* ── Meu Plano (hero na cor do plano) ── */}
        <View style={[styles.card, styles.heroCard, shadows.card, { backgroundColor: PLAN_COLOR[userPlan] }]}>
          <View style={styles.planHeader}>
            <Text style={[styles.sectionTitle, styles.heroText]}>Meu Plano</Text>
            <TouchableOpacity
              onPress={() => router.push('/meu-plano')}
              accessibilityLabel="Ver benefícios e opções de upgrade"
            >
              <Text style={styles.heroLink}>Ver planos</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.planRow}>
            <Text style={styles.heroPlanName}>{userPlan}</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Ativo</Text>
            </View>
          </View>
          <Text style={styles.heroDesc}>
            Acesso à infraestrutura premium, recepção assistida e agendamento online.
          </Text>
          {userPlan !== 'VIP' && (
            <TouchableOpacity
              style={styles.heroUpgradeBtn}
              onPress={() => router.push('/meu-plano')}
              accessibilityLabel="Fazer upgrade do plano"
            >
              <Ionicons name="arrow-up-circle-outline" size={15} color={PLAN_COLOR[userPlan]} />
              <Text style={[styles.upgradeBtnText, { color: PLAN_COLOR[userPlan] }]}>
                {userPlan === 'START' ? 'Fazer Upgrade para BASE ou PRO' :
                 userPlan === 'BASE'  ? 'Fazer Upgrade para PRO' :
                                        'Ver Plano VIP (em breve)'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Indicação OLI ── */}
        <TouchableOpacity
          style={[styles.card, shadows.card, styles.referralCard]}
          onPress={() => router.push('/indicacao')}
          accessibilityLabel="Programa de Indicação — indique um colega e ganhe 1 hora grátis"
        >
          <View style={styles.referralIconWrap}>
            <Ionicons name="gift" size={22} color={colors.oliGreen} />
          </View>
          <View style={styles.referralInfo}>
            <Text style={styles.sectionTitle}>Indicação OLI</Text>
            <Text style={styles.planDesc}>
              Indique um colega médico. Quando ele se cadastrar, você ganha 1 hora grátis de sala.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.oliLightGray} />
        </TouchableOpacity>

        {/* ── Benefícios do Plano ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>
              {userPlan === 'START' ? 'Benefícios do seu plano' : `O que o ${userPlan} desbloqueia`}
            </Text>
            <Ionicons name="ribbon-outline" size={20} color={colors.oliGold} />
          </View>

          {planHighlights.map((f, i) => (
            <View
              key={f.label}
              style={[svcStyles.row, i < planHighlights.length - 1 && svcStyles.rowBorder]}
            >
              <View style={svcStyles.iconWrap}>
                <Ionicons name="checkmark" size={16} color={colors.oliGreen} />
              </View>
              <View style={svcStyles.info}>
                <Text style={svcStyles.name}>{f.label}</Text>
                {f.detail && <Text style={svcStyles.detail}>{f.detail}</Text>}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => router.push('/meu-plano')}
            accessibilityLabel="Ver todos os benefícios do plano"
          >
            <Text style={styles.upgradeBtnText}>Ver todos os benefícios</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.oliGold} />
          </TouchableOpacity>
        </View>

        {/* ── WhatsApp Recepção ── */}
        <TouchableOpacity
          style={styles.receptionBtn}
          onPress={() => contactReception()}
          accessibilityLabel="Falar com a recepção do OLI via WhatsApp"
        >
          <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
          <Text style={styles.receptionBtnText}>Falar com a Recepção</Text>
        </TouchableOpacity>

        {/* ── Módulos e Soluções ── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>
            Módulos e Soluções
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/modulos')}
            accessibilityLabel="Ver todos os módulos"
            style={{ paddingHorizontal: spacing.md }}
          >
            <Text style={styles.seeAllLink}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.sectionDesc, { paddingHorizontal: spacing.md }]}>
          Add-ons que potencializam seu plano. Cada módulo pode ser contratado individualmente.
        </Text>

        {!modulesLoaded ? (
          <View style={moduleStyles.loading}>
            <ActivityIndicator color={colors.oliGreen} />
          </View>
        ) : (
          <View style={moduleStyles.grid}>
            {HIGHLIGHT_MODULE_IDS.map((moduleId) => {
              const base     = MODULE_CATALOG[moduleId];
              const override = modulePriceMap.get(moduleId);
              const hasRealPrice = override && (override.valor > 0 || override.tipo === 'incluido');
              const mod: OLIModule = hasRealPrice
                ? {
                    ...base,
                    pricing: {
                      ...base.pricing,
                      amount:       override!.valor > 0 ? override!.valor : undefined,
                      displayLabel: buildModuleLabel(override!.valor, override!.tipo),
                    },
                  }
                : base;
              const included = isModuleIncludedInPlan(moduleId, userPlan);
              const active   = isModuleActive(moduleId, userPlan);
              return (
                <ModuleTile
                  key={moduleId}
                  module={mod}
                  userPlan={userPlan}
                  isIncluded={included}
                  isActive={active && !included}
                  onContractPress={setCheckoutModule}
                />
              );
            })}
          </View>
        )}

        {/* ── Especialistas OLI ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Especialistas OLI</Text>
            <View style={agentPreviewStyles.soonBadge}>
              <Ionicons name="time-outline" size={12} color={colors.oliGold} />
              <Text style={agentPreviewStyles.soonText}>Em breve</Text>
            </View>
          </View>
          <Text style={styles.planDesc}>
            5 especialistas de IA — jurídico, contábil, convênios, carreira e OLI — para tirar
            dúvidas direto pelo app.
          </Text>
          <View style={agentPreviewStyles.strip}>
            {AGENTS.map((a, i) => (
              <View
                key={a.title}
                style={[
                  agentPreviewStyles.avatar,
                  { backgroundColor: a.color, marginLeft: i === 0 ? 0 : -12, zIndex: AGENTS.length - i },
                ]}
              >
                {a.photo ? (
                  <Image source={a.photo} style={agentPreviewStyles.avatarImg} />
                ) : (
                  <Text style={agentPreviewStyles.avatarText}>{a.avatar}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── Modal de Checkout ── */}
      {checkoutModule && (
        <CheckoutModal
          visible={!!checkoutModule}
          module={checkoutModule}
          onClose={() => setCheckoutModule(null)}
        />
      )}

      <ScrollMoreIndicator visible={showScrollHint} />
      </View>
    </SafeAreaView>
  );
}

// ── ModuleTile (grid 2 colunas) ─────────────────────────────────────────────────

const PLAN_RANK: Record<PlanType, number> = { START: 0, BASE: 1, PRO: 2, VIP: 3 };

type ModuleDisplayStatus = 'included' | 'active' | 'available' | 'locked' | 'coming_soon';

const STATUS_LABEL: Record<ModuleDisplayStatus, string> = {
  included:    'Incluso no plano',
  active:      'Ativo',
  available:   'Disponível',
  locked:      'Bloqueado',
  coming_soon: 'Em breve',
};

const STATUS_COLOR: Record<ModuleDisplayStatus, string> = {
  included:    colors.oliGreen,
  active:      colors.oliGreen,
  available:   colors.oliGold,
  locked:      colors.oliLightGray,
  coming_soon: colors.oliLightGray,
};

function ModuleTile({
  module, userPlan, isIncluded, isActive, onContractPress,
}: {
  module:           OLIModule;
  userPlan:         PlanType;
  isIncluded:       boolean;
  isActive:         boolean;
  onContractPress?: (module: OLIModule) => void;
}) {
  const canContract = PLAN_RANK[userPlan] >= PLAN_RANK[module.requiredPlan];

  let status: ModuleDisplayStatus;
  if (module.status === 'coming_soon') status = 'coming_soon';
  else if (isIncluded)  status = 'included';
  else if (isActive)    status = 'active';
  else if (canContract) status = 'available';
  else                  status = 'locked';

  const statusColor = STATUS_COLOR[status];

  const handleCTA = () => contractModule(module, (m) => onContractPress?.(m));

  const handleInfo = () => Alert.alert(module.name, module.description);

  const handleLocked = () => {
    Alert.alert(
      `Requer Plano ${module.requiredPlan}`,
      `Este módulo está disponível a partir do plano ${module.requiredPlan}. Faça upgrade para acessá-lo.`,
    );
  };

  return (
    <View style={[tileStyles.tile, shadows.small, { borderColor: `${statusColor}55` }]}>
      <TouchableOpacity
        style={tileStyles.infoBtn}
        onPress={handleInfo}
        accessibilityLabel={`Mais informações sobre ${module.name}`}
      >
        <Ionicons name="information-circle-outline" size={18} color={colors.oliLightGray} />
      </TouchableOpacity>

      <Text style={tileStyles.name} numberOfLines={2}>{module.name}</Text>
      <Text style={tileStyles.price}>{module.pricing.displayLabel}</Text>

      {status === 'available' && (
        <TouchableOpacity
          style={[tileStyles.cta, { borderColor: statusColor }]}
          onPress={handleCTA}
          accessibilityLabel={`Contratar módulo ${module.name}`}
        >
          <Text style={[tileStyles.ctaText, { color: statusColor }]}>Contratar</Text>
        </TouchableOpacity>
      )}

      {status === 'locked' && (
        <TouchableOpacity
          style={[tileStyles.cta, { borderColor: `${colors.oliLightGray}60` }]}
          onPress={handleLocked}
          accessibilityLabel={`Módulo requer plano ${module.requiredPlan}`}
        >
          <Text style={[tileStyles.ctaText, { color: colors.oliLightGray }]} numberOfLines={1}>
            Requer {module.requiredPlan}
          </Text>
        </TouchableOpacity>
      )}

      {(status === 'included' || status === 'active' || status === 'coming_soon') && (
        <View style={[tileStyles.statusPill, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[tileStyles.statusPillText, { color: statusColor }]}>
            {STATUS_LABEL[status]}
          </Text>
        </View>
      )}
    </View>
  );
}

const moduleStyles = StyleSheet.create({
  loading: { paddingVertical: spacing.lg, alignItems: 'center' },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

const tileStyles = StyleSheet.create({
  tile:           { width: '47%', backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, padding: spacing.sm, gap: 4 },
  infoBtn:        { position: 'absolute', top: 6, right: 6, padding: 2, zIndex: 1 },
  name:           { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray, marginRight: 18, minHeight: 34 },
  price:          { fontSize: 12, fontWeight: '700', color: colors.oliDarkGray },
  cta:            { marginTop: 4, alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 7 },
  ctaText:        { fontSize: 11, fontWeight: '700' },
  statusPill:     { marginTop: 4, alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
});

// ── Especialistas OLI (preview) — Styles ────────────────────────────────────────

const agentPreviewStyles = StyleSheet.create({
  soonBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.oliGold}18`, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  soonText:   { fontSize: 11, fontWeight: '700', color: colors.oliGold },
  strip:      { flexDirection: 'row', marginTop: spacing.sm },
  avatar:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.white, overflow: 'hidden' },
  avatarImg:  { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});

// ── Benefícios do Plano — Styles (linhas com check, reaproveitado do antigo "Serviços Inclusos") ──

const svcStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  iconWrap:  { width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.oliGreen}12`, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  info:      { flex: 1 },
  name:      { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  detail:    { fontSize: 12, color: colors.gray, marginTop: 2 },
});

// ── Main Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },

  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
  },
  cardHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAllLink:       { fontSize: 13, fontWeight: '600', color: colors.oliGold },
  planHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:     { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  planRow:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  planDesc:         { fontSize: 14, color: colors.gray, lineHeight: 20 },
  upgradeBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  upgradeBtnText:   { fontSize: 13, fontWeight: '700', color: colors.oliGold },
  sectionDesc:      { fontSize: 13, color: colors.gray, lineHeight: 18, marginTop: -spacing.xs },

  // ── Hero do plano (fundo na cor do plano) ──
  heroCard:         { overflow: 'hidden' },
  heroText:         { color: colors.white },
  heroLink:         { fontSize: 14, fontWeight: '700', color: colors.white, textDecorationLine: 'underline' },
  heroPlanName:     { fontSize: 24, fontWeight: '700', color: colors.white },
  heroBadge:        { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  heroBadgeText:    { color: colors.white, fontSize: 12, fontWeight: '700' },
  heroDesc:         { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 20 },
  heroUpgradeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: colors.white, borderRadius: radius.full, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7 },
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

  referralCard:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  referralIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.oliGreen}15`, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  referralInfo:     { flex: 1, gap: 2 },
});
