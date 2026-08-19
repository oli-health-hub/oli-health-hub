/**
 * Tela: Módulos à la carte
 * Lista todos os módulos do catálogo com status de ativação e checkout.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore }    from '../src/store/appStore';
import { useAuthStore }   from '../src/store/authStore';
import { useModuleStore } from '../src/store/moduleStore';
import { colors, radius, shadows, spacing } from '../src/theme/designSystem';
import {
  MODULE_CATALOG,
  isModuleIncludedInPlan,
  type ModuleId,
  type OLIModule,
} from '../src/models/modules';
import CheckoutModal from '../src/components/CheckoutModal';
import { contractModule } from '../src/utils/moduleContract';
import type { PlanType } from '../src/models/types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_RANK: Record<PlanType, number> = { START: 0, BASE: 1, PRO: 2, VIP: 3 };

const CATEGORY_LABELS: Record<string, string> = {
  tecnologia: 'Tecnologia',
  contabil:   'Contabilidade',
  juridico:   'Jurídico',
};

const CATEGORY_ICONS: Record<string, string> = {
  tecnologia: 'laptop-outline',
  contabil:   'calculator-outline',
  juridico:   'briefcase-outline',
};

function formatPrice(module: OLIModule): string {
  const p = module.pricing;
  if (p.period === 'included') return 'Incluso no plano';
  if (!p.amount || p.amount === 0) return 'Contato comercial';
  const val = p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (p.period === 'monthly')   return `${val}/mês`;
  if (p.period === 'one_time')  return `${val} (único)`;
  if (p.period === 'per_unit')  return `${val} ${p.unitLabel ?? ''}`;
  return p.displayLabel;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function ModulosScreen() {
  const { userPlan } = useAppStore();
  const user         = useAuthStore((s) => s.user);
  const { loadModules, isModuleActive, isLoaded } = useModuleStore();
  const router       = useRouter();
  const [checkoutModule, setCheckoutModule] = useState<OLIModule | null>(null);

  useEffect(() => {
    if (user?.id) loadModules(user.id, userPlan);
  }, [user?.id, userPlan]);

  // Agrupa módulos por categoria
  const grouped = (Object.keys(MODULE_CATALOG) as ModuleId[]).reduce<Record<string, ModuleId[]>>(
    (acc, id) => {
      const category = getCategoryForId(id);
      if (!acc[category]) acc[category] = [];
      acc[category].push(id);
      return acc;
    },
    {},
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Módulos e Soluções', headerBackTitle: 'Voltar' }} />

      {!isLoaded ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.oliGreen} />
          <Text style={styles.loadingText}>Carregando módulos…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <Text style={styles.intro}>
            Potencialize seu plano {userPlan} com módulos contratados individualmente.
          </Text>

          {Object.entries(grouped).map(([category, moduleIds]) => (
            <View key={category}>
              <View style={styles.catHeader}>
                <Ionicons
                  name={(CATEGORY_ICONS[category] ?? 'grid-outline') as 'grid-outline'}
                  size={16}
                  color={colors.oliGreen}
                />
                <Text style={styles.catTitle}>
                  {CATEGORY_LABELS[category] ?? category}
                </Text>
              </View>

              {moduleIds.map((moduleId) => {
                const mod      = MODULE_CATALOG[moduleId];
                const included = isModuleIncludedInPlan(moduleId, userPlan);
                const active   = isModuleActive(moduleId, userPlan);
                const canAccess = PLAN_RANK[userPlan] >= PLAN_RANK[mod.requiredPlan];

                return (
                  <ModuleRow
                    key={moduleId}
                    module={mod}
                    included={included}
                    active={active}
                    canAccess={canAccess}
                    userPlan={userPlan}
                    onContract={() => contractModule(mod, setCheckoutModule)}
                    onUpgrade={() => router.push('/meu-plano')}
                  />
                );
              })}
            </View>
          ))}

          <View style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.oliGreen} />
            <Text style={styles.noteText}>
              Módulos com ativação OLI são configurados pela nossa equipe em até 2 dias úteis após a confirmação do pagamento.
            </Text>
          </View>
        </ScrollView>
      )}

      {checkoutModule && (
        <CheckoutModal
          visible={!!checkoutModule}
          module={checkoutModule}
          onClose={() => setCheckoutModule(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ModuleRow
// ─────────────────────────────────────────────────────────────────────────────

function ModuleRow({
  module, included, active, canAccess, userPlan, onContract, onUpgrade,
}: {
  module:    OLIModule;
  included:  boolean;
  active:    boolean;
  canAccess: boolean;
  userPlan:  PlanType;
  onContract: () => void;
  onUpgrade:  () => void;
}) {
  const isComingSoon = module.status === 'coming_soon';
  const isBeta       = module.status === 'beta';

  return (
    <View style={[styles.moduleCard, shadows.card]}>
      {/* Header */}
      <View style={styles.moduleHeader}>
        <View style={styles.moduleTitleWrap}>
          <Text style={styles.moduleName}>{module.name}</Text>
          <TouchableOpacity
            onPress={() => Alert.alert(module.name, module.description)}
            accessibilityLabel={`Mais informações sobre ${module.name}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.oliLightGray} />
          </TouchableOpacity>
          {isBeta && (
            <View style={styles.betaBadge}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
          )}
          {isComingSoon && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>EM BREVE</Text>
            </View>
          )}
        </View>

        {/* Status badge */}
        {active || included ? (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.white} />
            <Text style={styles.activeBadgeText}>{included ? 'Incluso' : 'Ativo'}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.moduleTagline}>{module.tagline}</Text>

      <View style={styles.moduleFooter}>
        <Text style={styles.modulePrice}>{formatPrice(module)}</Text>

        {!isComingSoon && !active && !included && (
          canAccess ? (
            <TouchableOpacity
              style={styles.contractBtn}
              onPress={onContract}
              accessibilityLabel={`Contratar módulo ${module.name}`}
            >
              <Text style={styles.contractBtnText}>Contratar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={onUpgrade}
              accessibilityLabel={`Requer plano ${module.requiredPlan}`}
            >
              <Text style={styles.upgradeBtnText}>Requer {module.requiredPlan}</Text>
            </TouchableOpacity>
          )
        )}

        {isComingSoon && (
          <View style={styles.comingSoonChip}>
            <Text style={styles.comingSoonChipText}>Em breve</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: categoria por module ID
// ─────────────────────────────────────────────────────────────────────────────

function getCategoryForId(id: ModuleId): string {
  if (id === 'communicare')    return 'tecnologia';
  if (id === 'contabil_mello') return 'contabil';
  return 'juridico';
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: 14, color: colors.gray },

  intro: { fontSize: 14, color: colors.oliLightGray, lineHeight: 20 },

  catHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginTop:     spacing.sm,
    marginBottom:  spacing.xs,
  },
  catTitle: { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray, textTransform: 'uppercase', letterSpacing: 0.5 },

  moduleCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  moduleHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  moduleTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  moduleName:      { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  moduleTagline:   { fontSize: 13, color: colors.gray, marginBottom: spacing.md, lineHeight: 18 },

  moduleFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modulePrice:  { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray },

  activeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.oliGreen, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.white },

  betaBadge:       { backgroundColor: `${colors.oliGold}20`, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  betaText:        { fontSize: 9,  fontWeight: '700', color: colors.oliGold },
  comingSoonBadge: { backgroundColor: `${colors.gray}20`, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  comingSoonText:  { fontSize: 9,  fontWeight: '700', color: colors.gray },

  contractBtn:     { backgroundColor: colors.oliGreen, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  contractBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  upgradeBtn:      { backgroundColor: `${colors.oliGold}20`, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  upgradeBtnText:  { fontSize: 12, fontWeight: '700', color: colors.oliGold },

  comingSoonChip:     { backgroundColor: `${colors.gray}15`, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  comingSoonChipText: { fontSize: 12, color: colors.gray },

  noteCard: {
    flexDirection: 'row',
    gap:           spacing.sm,
    backgroundColor: `${colors.oliGreen}10`,
    borderRadius:  radius.md,
    padding:       spacing.md,
    alignItems:    'flex-start',
  },
  noteText: { flex: 1, fontSize: 12, color: colors.oliGreen, lineHeight: 18 },
});
