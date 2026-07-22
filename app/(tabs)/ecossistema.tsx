import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/appStore';
import { contactReception } from '../../src/utils/whatsapp';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import type { PlanType } from '../../src/models/types';
import { FEATURES, type Feature } from '../meu-plano';
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
  const [showScrollHint, setShowScrollHint] = useState(true);

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
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Módulos e Soluções</Text>
            <Ionicons name="grid-outline" size={20} color={colors.oliGold} />
          </View>
          <Text style={styles.planDesc}>
            Communicare, Contabilidade Médica, Scribe IA e mais — add-ons que potencializam
            seu plano, contratados individualmente.
          </Text>
          <TouchableOpacity
            style={styles.modulesBtn}
            onPress={() => router.push('/modulos')}
            accessibilityLabel="Ver todos os módulos e soluções"
          >
            <Text style={styles.modulesBtnText}>Ver Módulos e Soluções</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </TouchableOpacity>
        </View>

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

      <ScrollMoreIndicator visible={showScrollHint} />
      </View>
    </SafeAreaView>
  );
}

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
  planHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:     { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  planRow:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  planDesc:         { fontSize: 14, color: colors.gray, lineHeight: 20 },
  upgradeBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  upgradeBtnText:   { fontSize: 13, fontWeight: '700', color: colors.oliGold },
  modulesBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.oliGold, borderRadius: radius.md, paddingVertical: 13, marginTop: spacing.sm },
  modulesBtnText:   { color: colors.white, fontSize: 15, fontWeight: '700' },

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
