import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Image, Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/appStore';
import { contactReception } from '../../src/utils/whatsapp';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import { useAuthStore } from '../../src/store/authStore';
import { useModuleStore } from '../../src/store/moduleStore';
import { MODULE_CATALOG, isModuleIncludedInPlan, type ModuleId, type OLIModule } from '../../src/models/modules';
import type { PlanType } from '../../src/models/types';
import CheckoutModal from '../../src/components/CheckoutModal';
import { ScrollMoreIndicator } from '../../src/components/ScrollMoreIndicator';

// ─── Serviços Inclusos no Plano ───────────────────────────────────────────────

type ServiceItem = {
  icon:        string;
  name:        string;
  detail:      string;
  marketPrice: number;
  unit:        string;
};

const INCLUDED_SERVICES: ServiceItem[] = [
  { icon: 'people-outline',         name: 'Recepção Assistida',  detail: 'Secretária compartilhada — 20 dias úteis', marketPrice: 2_500.00, unit: 'mês'     },
  { icon: 'document-text-outline',  name: 'Consultoria Jurídica', detail: '1 de 3 consultas incluídas',              marketPrice:   350.00, unit: 'consulta' },
  { icon: 'calculator-outline',     name: 'Consultoria Contábil', detail: '1 consulta incluída',                     marketPrice:   300.00, unit: 'consulta' },
  { icon: 'location-outline',       name: 'Endereço Fiscal',      detail: 'CNPJ registrado no OLI',                  marketPrice:   150.00, unit: 'mês'     },
  { icon: 'wifi-outline',           name: 'Internet Fibra 1 Gb',  detail: 'Uso nas salas',                           marketPrice:   120.00, unit: 'mês'     },
  { icon: 'star-outline',           name: 'Evento OLI',           detail: '1 evento incluído / mês',                 marketPrice:   200.00, unit: 'evento'  },
];

const totalMarketValue = INCLUDED_SERVICES.reduce((acc, s) => acc + s.marketPrice, 0);

// ─────────────────────────────────────────────────────────────────────────────

export default function EcossistemaScreen() {
  const { userPlan } = useAppStore();
  const router = useRouter();
  const [checkoutModule, setCheckoutModule] = useState<OLIModule | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  const user = useAuthStore((s) => s.user);
  const { loadModules, isModuleActive, isLoaded: modulesLoaded } = useModuleStore();

  useEffect(() => {
    if (user?.id) loadModules(user.id, userPlan);
  }, [user?.id, userPlan]);

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

        {/* ── Meu Plano ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.planHeader}>
            <Text style={styles.sectionTitle}>Meu Plano</Text>
            <TouchableOpacity
              onPress={() => router.push('/meu-plano')}
              accessibilityLabel="Ver benefícios e opções de upgrade"
            >
              <Text style={styles.upgradeLink}>Ver planos</Text>
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
              onPress={() => router.push('/meu-plano')}
              accessibilityLabel="Fazer upgrade do plano"
            >
              <Ionicons name="arrow-up-circle-outline" size={15} color={colors.oliGold} />
              <Text style={styles.upgradeBtnText}>
                {userPlan === 'START' ? 'Fazer Upgrade para BASE ou PRO' :
                 userPlan === 'BASE'  ? 'Fazer Upgrade para PRO' :
                                        'Ver Plano VIP (em breve)'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Serviços Inclusos no Plano ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Serviços Inclusos</Text>
            <Ionicons name="gift-outline" size={20} color={colors.oliGold} />
          </View>

          {INCLUDED_SERVICES.map((svc, i) => (
            <View
              key={svc.name}
              style={[svcStyles.row, i < INCLUDED_SERVICES.length - 1 && svcStyles.rowBorder]}
            >
              <View style={svcStyles.iconWrap}>
                <Ionicons name={svc.icon as any} size={18} color={colors.oliGreen} />
              </View>
              <View style={svcStyles.info}>
                <Text style={svcStyles.name}>{svc.name}</Text>
                <Text style={svcStyles.detail}>{svc.detail}</Text>
              </View>
              <Text style={svcStyles.marketPrice}>
                R${svc.marketPrice.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/{svc.unit}
              </Text>
            </View>
          ))}

          <View style={svcStyles.footer}>
            <Text style={svcStyles.footerLabel}>Valor de mercado destes serviços</Text>
            <Text style={svcStyles.footerValue}>
              R${totalMarketValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/mês
            </Text>
          </View>
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
        ) : (Object.keys(MODULE_CATALOG) as ModuleId[]).map((moduleId) => {
          const mod      = MODULE_CATALOG[moduleId];
          const included = isModuleIncludedInPlan(moduleId, userPlan);
          const active   = isModuleActive(moduleId, userPlan);
          return (
            <ModuleCard
              key={moduleId}
              module={mod}
              userPlan={userPlan}
              isIncluded={included}
              isActive={active && !included}
              onContractPress={setCheckoutModule}
            />
          );
        })}

        {/* ── Especialistas OLI ── */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>
          Especialistas OLI
        </Text>
        <Text style={[styles.sectionDesc, { paddingHorizontal: spacing.md }]}>
          Nossos especialistas de IA estão chegando. Em breve você poderá tirar dúvidas
          especializadas diretamente por aqui.
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
            comingSoon
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
            comingSoon
          />
          <View style={styles.agentDivider} />
          <AgentCard
            avatar="A"
            color={colors.oliCoral}
            title="Amanda"
            role="OLI Convênios"
            subtitle="Credenciamento, faturamento TISS e glosas"
            onPress={() => router.push('/chatbot?persona=convenios')}
            comingSoon
          />
          <View style={styles.agentDivider} />
          <AgentCard
            avatar="R"
            color={colors.oliPurple}
            title="Ronaldo"
            role="OLI Carreira"
            subtitle="Posicionamento, captação e gestão de no-show"
            onPress={() => router.push('/chatbot?persona=carreira')}
            comingSoon
          />
          <View style={styles.agentDivider} />
          <AgentCard
            avatar="O"
            color="#7B9E82"
            title="Olivia"
            role="OLI Health Hub"
            subtitle="Salas, planos, reservas e eventos"
            onPress={() => router.push('/chatbot?persona=olivia')}
            comingSoon
          />
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

// ── ModuleCard ────────────────────────────────────────────────────────────────

const PLAN_RANK: Record<PlanType, number> = { START: 0, BASE: 1, PRO: 2, VIP: 3 };

type ModuleDisplayStatus = 'included' | 'active' | 'available' | 'locked' | 'coming_soon';

function ModuleCard({
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

  const STATUS_LABEL: Record<ModuleDisplayStatus, string> = {
    included:    'Incluso no plano',
    active:      'Ativo',
    available:   'Disponível',
    locked:      `Requer ${module.requiredPlan}`,
    coming_soon: 'Em breve',
  };

  const STATUS_COLOR: Record<ModuleDisplayStatus, string> = {
    included:    colors.oliGreen,
    active:      colors.oliGreen,
    available:   colors.oliGold,
    locked:      colors.oliLightGray,
    coming_soon: colors.oliLightGray,
  };

  const statusColor = STATUS_COLOR[status];

  const handleCTA = async () => {
    if (module.activationType === 'in_app_form' && module.pricing.amount !== undefined) {
      onContractPress?.(module);
      return;
    }
    await contactReception(
      `Olá! Tenho interesse em contratar o módulo *${module.name}* (${module.provider}). Poderia me passar mais informações?`
    );
  };

  const handleLocked = () => {
    Alert.alert(
      `Requer Plano ${module.requiredPlan}`,
      `Este módulo está disponível a partir do plano ${module.requiredPlan}. Faça upgrade para acessá-lo.`,
    );
  };

  return (
    <View style={[moduleStyles.card, shadows.small]}>
      <View style={[moduleStyles.accentBar, { backgroundColor: statusColor }]} />
      <View style={moduleStyles.body}>
        <View style={moduleStyles.headerRow}>
          <View style={moduleStyles.titleGroup}>
            <Text style={moduleStyles.name}>{module.name}</Text>
            <Text style={moduleStyles.provider}>{module.provider}</Text>
          </View>
          <View style={[moduleStyles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            {(status === 'included' || status === 'active') && (
              <Ionicons name="checkmark-circle" size={11} color={statusColor} />
            )}
            {status === 'locked' && (
              <Ionicons name="lock-closed" size={11} color={statusColor} />
            )}
            <Text style={[moduleStyles.statusText, { color: statusColor }]}>
              {STATUS_LABEL[status]}
            </Text>
          </View>
        </View>

        <Text style={moduleStyles.tagline}>{module.tagline}</Text>

        <View style={moduleStyles.footer}>
          <Text style={moduleStyles.price}>{module.pricing.displayLabel}</Text>

          {status === 'available' && (
            <TouchableOpacity
              style={[moduleStyles.cta, { borderColor: statusColor }]}
              onPress={handleCTA}
              accessibilityLabel={`Contratar módulo ${module.name}`}
            >
              <Text style={[moduleStyles.ctaText, { color: statusColor }]}>Contratar</Text>
              <Ionicons name="arrow-forward" size={13} color={statusColor} />
            </TouchableOpacity>
          )}

          {status === 'locked' && (
            <TouchableOpacity
              style={[moduleStyles.cta, { borderColor: `${colors.oliLightGray}60` }]}
              onPress={handleLocked}
              accessibilityLabel={`Módulo requer plano ${module.requiredPlan}`}
            >
              <Text style={[moduleStyles.ctaText, { color: colors.oliLightGray }]}>
                Upgrade para {module.requiredPlan}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const moduleStyles = StyleSheet.create({
  loading:     { paddingVertical: spacing.lg, alignItems: 'center' },
  card:        { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden' },
  accentBar:   { width: 4 },
  body:        { flex: 1, padding: spacing.md, gap: 6 },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleGroup:  { flex: 1, gap: 2 },
  name:        { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  provider:    { fontSize: 12, color: colors.oliLightGray },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  tagline:     { fontSize: 13, color: colors.gray, lineHeight: 18 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  price:       { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray },
  cta:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14 },
  ctaText:     { fontSize: 12, fontWeight: '700' },
});

// ── AgentCard ─────────────────────────────────────────────────────────────────

function AgentCard({
  avatar, photo, color, title, role, subtitle, onPress, comingSoon,
}: {
  avatar:   string;
  photo?:   ReturnType<typeof require>;
  color:    string;
  title:    string;
  role:     string;
  subtitle: string;
  onPress:  () => void;
  comingSoon?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[agentStyles.row, comingSoon && agentStyles.rowDisabled]}
      onPress={comingSoon ? undefined : onPress}
      disabled={comingSoon}
      activeOpacity={comingSoon ? 1 : 0.75}
      accessibilityLabel={comingSoon ? `${title} — ${role} — em breve` : `Consultar ${title} — ${role}`}
    >
      <View style={[agentStyles.avatar, { backgroundColor: color }]}>
        {photo ? (
          <Image source={photo} style={agentStyles.photo} />
        ) : (
          <Text style={agentStyles.avatarText}>{avatar}</Text>
        )}
      </View>
      <View style={agentStyles.info}>
        <View style={agentStyles.nameRow}>
          <Text style={agentStyles.name}>{title}</Text>
          <View style={[agentStyles.roleBadge, { backgroundColor: `${color}18` }]}>
            <Text style={[agentStyles.roleText, { color }]}>{role}</Text>
          </View>
        </View>
        <Text style={agentStyles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      {comingSoon ? (
        <View style={agentStyles.soonBadge}>
          <Ionicons name="time-outline" size={12} color={colors.oliGold} />
          <Text style={agentStyles.soonText}>Em breve</Text>
        </View>
      ) : (
        <View style={[agentStyles.chatBtn, { backgroundColor: `${color}15` }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={color} />
        </View>
      )}
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
  rowDisabled:{ opacity: 0.55 },
  soonBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.oliGold}18`, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  soonText:   { fontSize: 11, fontWeight: '700', color: colors.oliGold },
});

// ── Serviços Inclusos Styles ──────────────────────────────────────────────────

const svcStyles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 11 },
  rowBorder:  { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  iconWrap:   { width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.oliGreen}12`, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  info:       { flex: 1 },
  name:       { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  detail:     { fontSize: 12, color: colors.gray, marginTop: 2 },
  marketPrice:{ fontSize: 13, fontWeight: '700', color: colors.oliDarkGray },
  footer:     { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel:{ fontSize: 13, color: colors.gray },
  footerValue:{ fontSize: 14, fontWeight: '700', color: colors.oliGold },
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
  upgradeLink:      { fontSize: 14, fontWeight: '700', color: colors.oliGold },
  planRow:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  planName:         { fontSize: 24, fontWeight: '700', color: colors.oliGreen },
  activeBadge:      { backgroundColor: colors.oliGreen, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText:  { color: colors.white, fontSize: 12, fontWeight: '700' },
  planDesc:         { fontSize: 14, color: colors.gray, lineHeight: 20 },
  upgradeBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  upgradeBtnText:   { fontSize: 13, fontWeight: '700', color: colors.oliGold },
  agentDivider:     { height: 0.5, backgroundColor: colors.border, marginHorizontal: spacing.md },
  sectionDesc:      { fontSize: 13, color: colors.gray, lineHeight: 18, marginTop: -spacing.xs },
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
});
