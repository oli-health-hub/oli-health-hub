/**
 * Tela: Meu Plano
 * Cards clicáveis → expande lista de benefícios (incluso / bloqueado).
 * Ciclos: START sem assinatura | BASE mensal ou anual | PRO anual | VIP em breve
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../src/store/appStore';
import { useAuthStore } from '../src/store/authStore';
import { supabase } from '../src/services/supabase';
import { colors, radius, shadows, spacing } from '../src/theme/designSystem';
import PlanCheckoutModal from '../src/components/PlanCheckoutModal';
import { useModuleStore } from '../src/store/moduleStore';
import { MODULE_CATALOG } from '../src/models/modules';
import type { PlanType } from '../src/models/types';

// ─────────────────────────────────────────────────────────────────────────────
// DADOS
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_ORDER: PlanType[] = ['START', 'BASE', 'PRO', 'VIP'];

interface PlanMeta {
  id:        string | null; // null → plano gratuito, sem checkout
  name:      PlanType;
  price:     number;         // mensalidade (0 = gratuito)
  taxaMin:   number;         // R$/min (0 = em estruturação)
  color:     string;
  hasCiclo:  boolean;        // true → BASE pode escolher mensal/anual
  forceAnual:boolean;        // true → PRO/VIP: apenas anual
  available: boolean;        // false → VIP em breve
}

const PLANS: PlanMeta[] = [
  {
    id:         null,
    name:       'START',
    price:      0,
    taxaMin:    2.00,
    color:      colors.oliLightGray,
    hasCiclo:   false,
    forceAnual: false,
    available:  true,
  },
  {
    id:         'e841ade4-4616-4e27-b84f-8e79fec3d98e',
    name:       'BASE',
    price:      299,
    taxaMin:    1.50,
    color:      colors.oliGreen,
    hasCiclo:   true,
    forceAnual: false,
    available:  true,
  },
  {
    id:         '19fcea22-4f61-4a5f-a80e-f120144ac54e',
    name:       'PRO',
    price:      599,
    taxaMin:    1.30,
    color:      colors.oliGold,
    hasCiclo:   false,
    forceAnual: true,
    available:  true,
  },
  {
    id:         '3025dbde-f713-4b70-8e7d-b62c14f69748',
    name:       'VIP',
    price:      0,
    taxaMin:    0,
    color:      '#7B6EA8',
    hasCiclo:   false,
    forceAnual: true,
    available:  false,   // Em estruturação
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MATRIZ DE BENEFÍCIOS (fonte: Panorama Contratual v3.0)
// ─────────────────────────────────────────────────────────────────────────────

type FeatureStatus = 'yes' | 'no' | 'soon';

interface Feature {
  label:           string;
  detail?:         string;
  /** Rótulo quantitativo por plano — exibido como detalhe quando o status é 'yes' */
  planLabel?:      Partial<Record<PlanType, string>>;
  /** Cor do rótulo por plano — sobrescreve a cor padrão (oliGreen) */
  planLabelColor?: Partial<Record<PlanType, string>>;
  category:        string;
  plans:           Record<PlanType, FeatureStatus>;
}

const FEATURE_CATEGORIES = [
  'INFRAESTRUTURA FÍSICA',
  'APP E COMUNIDADE',
  'DIAGNÓSTICOS COM PARCEIROS',
  'GESTÃO PRO',
  'SERVIÇOS VIP (EM BREVE)',
] as const;

const FEATURES: Feature[] = [
  // ── INFRAESTRUTURA FÍSICA ──
  {
    label:    'Acesso aos consultórios',
    category: 'INFRAESTRUTURA FÍSICA',
    plans:    { START: 'yes', BASE: 'yes', PRO: 'yes', VIP: 'yes' },
  },
  {
    label:    'Conforto médico',
    category: 'INFRAESTRUTURA FÍSICA',
    plans:    { START: 'no', BASE: 'yes', PRO: 'yes', VIP: 'yes' },
  },
  {
    label:      'Impressão e digitalização',
    category:   'INFRAESTRUTURA FÍSICA',
    plans:           { START: 'no', BASE: 'yes', PRO: 'yes', VIP: 'yes' },
    planLabel:       { BASE: '10 cópias/mês', PRO: '50 cópias/mês', VIP: 'Ilimitado' },
    planLabelColor:  { BASE: colors.oliGold, PRO: colors.oliGold },
  },
  // ── APP E COMUNIDADE ──
  {
    label:    'Comunidade OLI (app)',
    category: 'APP E COMUNIDADE',
    plans:    { START: 'yes', BASE: 'yes', PRO: 'yes', VIP: 'yes' },
  },
  {
    label:    'Timer de sessão, agenda e CRM de pacientes',
    category: 'APP E COMUNIDADE',
    plans:    { START: 'yes', BASE: 'yes', PRO: 'yes', VIP: 'yes' },
  },
  {
    label:    'Página pessoal + cartão de visita digital',
    category: 'APP E COMUNIDADE',
    plans:    { START: 'yes', BASE: 'yes', PRO: 'yes', VIP: 'soon' },
  },
  // ── DIAGNÓSTICOS COM PARCEIROS ──
  {
    label:    'Diagnóstico Contábil — Contábil Mello',
    detail:   '1 sessão de avaliação inclusa',
    category: 'DIAGNÓSTICOS COM PARCEIROS',
    plans:    { START: 'no', BASE: 'yes', PRO: 'yes', VIP: 'yes' },
  },
  {
    label:    'Diagnóstico Convênios/Carreira — AR Soluções',
    detail:   '1 sessão de avaliação inclusa',
    category: 'DIAGNÓSTICOS COM PARCEIROS',
    plans:    { START: 'no', BASE: 'yes', PRO: 'yes', VIP: 'yes' },
  },
  {
    label:    'Diagnóstico Jurídico — Dra. Ana',
    detail:   '1 sessão de avaliação inclusa',
    category: 'DIAGNÓSTICOS COM PARCEIROS',
    plans:    { START: 'no', BASE: 'yes', PRO: 'yes', VIP: 'yes' },
  },
  // ── GESTÃO PRO ──
  {
    label:    'CRM Communicare — Plano Básico incluso',
    category: 'GESTÃO PRO',
    plans:    { START: 'no', BASE: 'no', PRO: 'yes', VIP: 'yes' },
  },
  {
    label:    'Gestão de agenda pela recepção OLI',
    category: 'GESTÃO PRO',
    plans:    { START: 'no', BASE: 'no', PRO: 'yes', VIP: 'yes' },
  },
  {
    label:    'Emissão de NF gerenciada pela OLI',
    category: 'GESTÃO PRO',
    plans:    { START: 'no', BASE: 'no', PRO: 'yes', VIP: 'yes' },
  },
  // ── SERVIÇOS VIP ──
  {
    label:    'Gestão contínua de convênios — AR Soluções',
    category: 'SERVIÇOS VIP (EM BREVE)',
    plans:    { START: 'no', BASE: 'no', PRO: 'no', VIP: 'soon' },
  },
  {
    label:    'Consultoria jurídica contínua — Dra. Ana',
    category: 'SERVIÇOS VIP (EM BREVE)',
    plans:    { START: 'no', BASE: 'no', PRO: 'no', VIP: 'soon' },
  },
  {
    label:    'Contabilidade plena inclusa — Contábil Mello',
    category: 'SERVIÇOS VIP (EM BREVE)',
    plans:    { START: 'no', BASE: 'no', PRO: 'no', VIP: 'soon' },
  },
  {
    label:    'Gestão de carreira médica',
    category: 'SERVIÇOS VIP (EM BREVE)',
    plans:    { START: 'no', BASE: 'no', PRO: 'no', VIP: 'soon' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function taxaLabel(taxaMin: number): string {
  if (taxaMin === 0) return 'Taxa em estruturação';
  return `R$ ${taxaMin.toFixed(2).replace('.', ',')}/min de sessão`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TRIAL DISCLAIMER MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface TrialDisclaimerModalProps {
  visible:   boolean;
  plan:      PlanMeta;
  onClose:   () => void;
  onConfirm: () => void;
  loading:   boolean;
}

function TrialDisclaimerModal({ visible, plan, onClose, onConfirm, loading }: TrialDisclaimerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={trialStyles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
        <Pressable style={trialStyles.sheet} onPress={e => e.stopPropagation()} accessible={false}>

          <View style={trialStyles.iconWrap}>
            <Ionicons name="information-circle" size={32} color={colors.oliGold} />
          </View>

          <Text style={trialStyles.title}>Antes de experimentar o plano {plan.name}</Text>

          <Text style={trialStyles.intro}>
            A degustação é uma oportunidade única de 30 dias. Leia com atenção:
          </Text>

          <View style={trialStyles.itemRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.oliGold} style={trialStyles.itemIcon} />
            <Text style={trialStyles.itemText}>
              <Text style={trialStyles.itemBold}>Consultorias e serviços de estruturação</Text>
              {' '}podem levar mais de 30 dias para apresentar métricas claras e surtirem efeito. O período de degustação não garante resultados imediatos.
            </Text>
          </View>

          <View style={trialStyles.itemRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.oliGold} style={trialStyles.itemIcon} />
            <Text style={trialStyles.itemText}>
              <Text style={trialStyles.itemBold}>Contabilidade</Text>
              {' '}requer uma estruturação que, em média, leva mais de 90 dias para ser concluída. Resultados concretos exigem esse tempo mínimo.
            </Text>
          </View>

          <View style={trialStyles.itemRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.oliGold} style={trialStyles.itemIcon} />
            <Text style={trialStyles.itemText}>
              A degustação é válida <Text style={trialStyles.itemBold}>uma única vez</Text> e não pode ser acumulada ou reativada.
            </Text>
          </View>

          <View style={trialStyles.actions}>
            <TouchableOpacity
              style={trialStyles.cancelBtn}
              onPress={onClose}
              accessibilityLabel="Cancelar degustação"
            >
              <Text style={trialStyles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[trialStyles.confirmBtn, { backgroundColor: plan.color }]}
              onPress={onConfirm}
              disabled={loading}
              accessibilityLabel={`Confirmar degustação do plano ${plan.name}`}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={trialStyles.confirmText}>Entendi, ativar</Text>
              }
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SEUS SERVIÇOS — inclusos no plano + contratados à parte
// ─────────────────────────────────────────────────────────────────────────────

function SeusServicos() {
  const { userPlan } = useAppStore();
  const { profile } = useAuthStore();
  const { activeModules, loadModules, isLoaded } = useModuleStore();

  useEffect(() => {
    if (profile?.id) loadModules(profile.id, userPlan);
  }, [profile?.id, userPlan, loadModules]);

  const incluidos   = activeModules.filter(m => m.moduleDbId === ''  && m.status === 'active');
  const contratados = activeModules.filter(m => m.moduleDbId !== '' && m.status === 'active');

  if (!isLoaded || (incluidos.length === 0 && contratados.length === 0)) return null;

  return (
    <View style={[styles.servicesCard, shadows.card]}>
      <Text style={styles.servicesTitle}>Seus serviços</Text>

      {incluidos.length > 0 && (
        <View style={styles.servicesGroup}>
          <Text style={styles.servicesGroupLabel}>Incluído no seu plano</Text>
          {incluidos.map(m => (
            <ServiceRow key={m.id} moduleId={m.moduleId} included />
          ))}
        </View>
      )}

      {contratados.length > 0 && (
        <View style={styles.servicesGroup}>
          <Text style={styles.servicesGroupLabel}>Contratado à parte</Text>
          {contratados.map(m => (
            <ServiceRow key={m.id} moduleId={m.moduleId} />
          ))}
        </View>
      )}
    </View>
  );
}

function ServiceRow({ moduleId, included = false }: { moduleId: keyof typeof MODULE_CATALOG; included?: boolean }) {
  const meta = MODULE_CATALOG[moduleId];
  if (!meta) return null;

  return (
    <View style={styles.serviceRow}>
      <Ionicons
        name={included ? 'checkmark-circle' : 'cube-outline'}
        size={18}
        color={included ? colors.oliGreen : colors.oliGold}
      />
      <View style={styles.serviceInfo}>
        <Text style={styles.serviceName}>{meta.name}</Text>
        <Text style={styles.serviceProvider}>{meta.provider}</Text>
      </View>
      <Text style={[styles.servicePrice, included && styles.servicePriceIncluded]}>
        {included ? 'Incluído' : meta.pricing.displayLabel}
      </Text>
    </View>
  );
}

export default function MeuPlanoScreen() {
  const { userPlan } = useAppStore();
  const { profile, setProfile } = useAuthStore();
  const router = useRouter();

  const [expandedPlan, setExpandedPlan] = useState<PlanType>(userPlan);
  // Ciclo só se aplica ao BASE
  const [baseCiclo, setBaseCiclo] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [checkoutTarget, setCheckoutTarget] = useState<{ plan: PlanMeta; ciclo: 'MONTHLY' | 'YEARLY' } | null>(null);
  const [trialTarget,    setTrialTarget]    = useState<PlanMeta | null>(null);
  const [trialLoading,   setTrialLoading]   = useState(false);

  const currentPlanIndex = PLAN_ORDER.indexOf(userPlan);
  const nextUpgradePlan  = PLAN_ORDER[currentPlanIndex + 1] as PlanType | undefined;
  const trialAlreadyUsed = !!profile?.trial_activated_at;

  const canUpgradeTo = (name: PlanType) => PLAN_ORDER.indexOf(name) > currentPlanIndex;

  const handlePlanPress = (name: PlanType, available: boolean) => {
    if (!available) return;
    setExpandedPlan(prev => (prev === name ? prev : name));
  };

  const handleAssinar = (plan: PlanMeta) => {
    const ciclo = plan.forceAnual ? 'YEARLY' : baseCiclo;
    setCheckoutTarget({ plan, ciclo });
  };

  const handleActivateTrial = async () => {
    if (!trialTarget || !profile?.id) return;
    setTrialLoading(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ trial_activated_at: now, trial_plan: trialTarget.name })
        .eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, trial_activated_at: now, trial_plan: trialTarget.name });
      setTrialTarget(null);
      Alert.alert(
        'Degustação ativada!',
        `Você tem 30 dias para explorar todos os benefícios do plano ${trialTarget.name}. Aproveite!`,
        [{ text: 'OK' }],
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível ativar a degustação. Tente novamente.');
    } finally {
      setTrialLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Meu Plano', headerBackTitle: 'Voltar' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Indicador plano atual */}
        <View style={[styles.activePlanCard, shadows.card]}>
          <View>
            <Text style={styles.activePlanLabel}>Plano atual</Text>
            <Text style={styles.activePlanName}>{userPlan}</Text>
          </View>
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.white} />
            <Text style={styles.activeBadgeText}>Ativo</Text>
          </View>
        </View>

        {/* Seus serviços — inclusos no plano + contratados à parte */}
        <SeusServicos />

        {/* Hero — coworking físico (frame primário) */}
        <View style={[styles.heroCard, shadows.card]}>
          <Ionicons name="business-outline" size={22} color={colors.oliGreen} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Acesso aos consultórios OLI Health Hub</Text>
            <Text style={styles.heroSub}>
              Aluguel de salas físicas (clínica, ginecologia, psicologia, telemedicina).
              Cobrança por minuto de uso real. Benefícios adicionais variam por plano.
            </Text>
          </View>
        </View>

        {/* Lista de planos */}
        {PLANS.map((plan) => {
          const isExpanded = expandedPlan === plan.name;
          const isCurrent  = plan.name === userPlan;
          const canUpgrade = canUpgradeTo(plan.name) && plan.available;

          return (
            <View
              key={plan.name}
              style={[
                styles.planWrapper,
                shadows.card,
                isCurrent && { borderColor: plan.color, borderWidth: 2 },
                !plan.available && styles.planWrapperDimmed,
              ]}
            >
              {/* ── Cabeçalho clicável ── */}
              <TouchableOpacity
                style={styles.planHeader}
                onPress={() => handlePlanPress(plan.name, plan.available)}
                activeOpacity={plan.available ? 0.75 : 1}
                accessibilityLabel={`Ver plano ${plan.name}`}
              >
                <View style={styles.planHeaderLeft}>
                  {/* Nome + badge */}
                  <View style={styles.planTitleRow}>
                    <Text style={[styles.planName, { color: plan.available ? plan.color : colors.gray }]}>
                      {plan.name}
                    </Text>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: plan.color }]}>
                        <Text style={styles.currentBadgeText}>Atual</Text>
                      </View>
                    )}
                    {!plan.available && (
                      <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonText}>Em breve</Text>
                      </View>
                    )}
                  </View>

                  {/* Preço / taxa */}
                  {plan.available ? (
                    <Text style={styles.planPriceHint}>
                      {plan.price === 0
                        ? 'Gratuito'
                        : `${formatCurrency(plan.price)}/mês`}
                      {' · '}
                      {taxaLabel(plan.taxaMin)}
                    </Text>
                  ) : (
                    <Text style={styles.planPriceHint}>Em estruturação</Text>
                  )}
                </View>

                {plan.available && (
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.gray}
                  />
                )}
              </TouchableOpacity>

              {/* ── Detalhes expandidos ── */}
              {isExpanded && plan.available && (
                <View style={styles.planDetail}>

                  {/* Preço grande */}
                  <View style={styles.priceSection}>
                    <View style={styles.priceRow}>
                      {plan.price > 0 ? (
                        <>
                          <Text style={styles.priceValue}>{formatCurrency(plan.price)}</Text>
                          <Text style={styles.pricePeriod}>/mês</Text>
                        </>
                      ) : (
                        <Text style={[styles.priceValue, { color: colors.oliGreen }]}>Gratuito</Text>
                      )}
                    </View>

                    <Text style={styles.taxaRow}>{taxaLabel(plan.taxaMin)}</Text>

                    {/* Ciclo selector — só BASE */}
                    {plan.hasCiclo && (
                      <View style={styles.cicloRow}>
                        <TouchableOpacity
                          style={[styles.cicloBtn, baseCiclo === 'MONTHLY' && { backgroundColor: plan.color }]}
                          onPress={() => setBaseCiclo('MONTHLY')}
                          accessibilityLabel="Assinatura mensal"
                        >
                          <Text style={[styles.cicloBtnText, baseCiclo === 'MONTHLY' && styles.cicloBtnTextActive]}>
                            Mensal
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cicloBtn, baseCiclo === 'YEARLY' && { backgroundColor: plan.color }]}
                          onPress={() => setBaseCiclo('YEARLY')}
                          accessibilityLabel="Assinatura anual — compromisso 12 meses"
                        >
                          <Text style={[styles.cicloBtnText, baseCiclo === 'YEARLY' && styles.cicloBtnTextActive]}>
                            Anual
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Nota ciclo PRO / VIP */}
                    {plan.forceAnual && (
                      <View style={styles.commitNote}>
                        <Ionicons name="calendar-outline" size={13} color={colors.oliGold} />
                        <Text style={styles.commitNoteText}>Comprometimento mínimo de 12 meses</Text>
                      </View>
                    )}

                    {/* Nota ciclo BASE anual */}
                    {plan.hasCiclo && baseCiclo === 'YEARLY' && (
                      <>
                        <View style={styles.commitNote}>
                          <Ionicons name="calendar-outline" size={13} color={colors.oliGold} />
                          <Text style={styles.commitNoteText}>
                            Cobrança de {formatCurrency(plan.price * 12)} antecipados · compromisso 12 meses
                          </Text>
                        </View>
                        <View style={styles.annualBonusNote}>
                          <Ionicons name="gift-outline" size={13} color={colors.oliGreen} />
                          <Text style={styles.annualBonusText}>
                            Bônus de ativação: 5 horas de crédito nos consultórios
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Lista de benefícios por categoria */}
                  {FEATURE_CATEGORIES.map((cat) => {
                    const catFeatures = FEATURES.filter(f => f.category === cat);
                    return (
                      <View key={cat} style={styles.categoryBlock}>
                        <Text style={styles.categoryTitle}>{cat}</Text>
                        {catFeatures.map((feat) => {
                          const status = feat.plans[plan.name];
                          return (
                            <View key={feat.label} style={styles.featureRow}>
                              {status === 'yes' ? (
                                <Ionicons name="checkmark-circle" size={18} color={colors.oliGreen} style={styles.featureIcon} />
                              ) : status === 'soon' ? (
                                <Ionicons name="time-outline" size={18} color={colors.oliGold} style={styles.featureIcon} />
                              ) : (
                                <Ionicons name="lock-closed-outline" size={18} color={colors.border} style={styles.featureIcon} />
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={[
                                  styles.featureLabel,
                                  status === 'no' && styles.featureLabelLocked,
                                ]}>
                                  {feat.label}
                                </Text>
                                {status !== 'no' && (feat.planLabel?.[plan.name] ?? feat.detail) && (
                                  <Text style={[
                                    styles.featureDetail,
                                    feat.planLabelColor?.[plan.name]
                                      ? { color: feat.planLabelColor[plan.name] }
                                      : undefined,
                                  ]}>
                                    {feat.planLabel?.[plan.name] ?? feat.detail}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}

                  {/* CTA */}
                  {canUpgrade ? (
                    <View style={styles.ctaStack}>
                      <TouchableOpacity
                        style={[styles.ctaBtn, { backgroundColor: plan.color }]}
                        onPress={() => handleAssinar(plan)}
                        accessibilityLabel={`Assinar plano ${plan.name}`}
                      >
                        <Ionicons name="arrow-up-circle-outline" size={18} color={colors.white} />
                        <Text style={styles.ctaBtnText}>Assinar {plan.name}</Text>
                      </TouchableOpacity>

                      {/* Trial — disponível para o próximo plano na hierarquia */}
                      {plan.name === nextUpgradePlan && plan.available && (
                        trialAlreadyUsed ? (
                          <View style={styles.ctaBtnTrialUsed}>
                            <Ionicons name="checkmark-done-outline" size={16} color={colors.gray} />
                            <Text style={[styles.ctaBtnTrialText, { color: colors.gray }]}>
                              Degustação já utilizada
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.ctaBtnTrial, { borderColor: plan.color }]}
                            onPress={() => setTrialTarget(plan)}
                            accessibilityLabel={`Experimentar plano ${plan.name} por 30 dias`}
                          >
                            <Ionicons name="flask-outline" size={16} color={plan.color} />
                            <Text style={[styles.ctaBtnTrialText, { color: plan.color }]}>
                              Experimentar 30 dias grátis
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  ) : isCurrent ? (
                    <View style={styles.ctaBtnCurrent}>
                      <Ionicons name="checkmark-circle" size={18} color={plan.color} />
                      <Text style={[styles.ctaBtnText, { color: plan.color }]}>Plano ativo</Text>
                    </View>
                  ) : (
                    <View style={styles.ctaBtnDisabled}>
                      <Text style={[styles.ctaBtnText, { color: colors.gray }]}>Plano inferior</Text>
                    </View>
                  )}

                </View>
              )}
            </View>
          );
        })}

        {/* Banner indicação */}
        <TouchableOpacity
          style={styles.referralBanner}
          onPress={() => router.push('/indicacao')}
          accessibilityLabel="Programa de indicação — ganhe 1 hora grátis"
        >
          <Ionicons name="gift-outline" size={20} color={colors.oliGold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.referralTitle}>Indicação OLI</Text>
            <Text style={styles.referralDesc}>Indique um colega e ganhe 1 hora de crédito →</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.oliGold} />
        </TouchableOpacity>

      </ScrollView>

      {/* Checkout modal */}
      {checkoutTarget && (
        <PlanCheckoutModal
          visible={!!checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          onSuccess={() => setCheckoutTarget(null)}
          planId={checkoutTarget.plan.id!}
          planName={checkoutTarget.plan.name}
          ciclo={checkoutTarget.ciclo}
          value={
            checkoutTarget.ciclo === 'YEARLY'
              ? checkoutTarget.plan.price * 12
              : checkoutTarget.plan.price
          }
        />
      )}

      {/* Trial disclaimer modal */}
      {trialTarget && (
        <TrialDisclaimerModal
          visible={!!trialTarget}
          plan={trialTarget}
          onClose={() => setTrialTarget(null)}
          onConfirm={handleActivateTrial}
          loading={trialLoading}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  activePlanCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
  },
  activePlanLabel:  { fontSize: 11, color: colors.gray, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  activePlanName:   { fontSize: 28, fontWeight: '800', color: colors.oliDarkGray, marginTop: 2 },
  activeBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.oliGreen, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  activeBadgeText:  { fontSize: 12, fontWeight: '700', color: colors.white },

  servicesCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.md,
  },
  servicesTitle:      { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.sm },
  servicesGroup:      { marginTop: spacing.xs },
  servicesGroupLabel: { fontSize: 12, fontWeight: '600', color: colors.oliLightGray, marginBottom: spacing.xs, marginTop: spacing.xs },
  serviceRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    paddingVertical: spacing.xs,
  },
  serviceInfo:        { flex: 1 },
  serviceName:        { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  serviceProvider:    { fontSize: 12, color: colors.oliLightGray },
  servicePrice:       { fontSize: 13, fontWeight: '600', color: colors.oliGold },
  servicePriceIncluded: { color: colors.oliGreen },

  heroCard: {
    backgroundColor:   '#EFF4F0',
    borderRadius:      radius.md,
    padding:           spacing.md,
    flexDirection:     'row',
    gap:               spacing.sm,
    alignItems:        'flex-start',
    borderLeftWidth:   3,
    borderLeftColor:   colors.oliGreen,
  },
  heroTitle: { fontSize: 13, fontWeight: '800', color: colors.oliDarkGray },
  heroSub:   { fontSize: 12, color: colors.gray, lineHeight: 17, marginTop: 3 },

  planWrapper: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    overflow:        'hidden',
  },
  planWrapperDimmed: { opacity: 0.55 },

  planHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        spacing.md,
  },
  planHeaderLeft:  { flex: 1 },
  planTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  planName:        { fontSize: 18, fontWeight: '800' },
  planPriceHint:   { fontSize: 12, color: colors.gray },

  currentBadge: {
    borderRadius:      radius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  currentBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white },

  comingSoonBadge: {
    backgroundColor:   `${colors.gray}20`,
    borderRadius:      radius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  comingSoonText: { fontSize: 10, fontWeight: '700', color: colors.gray },

  // ── Detail panel ──
  planDetail: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding:        spacing.md,
    gap:            spacing.lg,
  },

  priceSection: { gap: spacing.sm },
  priceRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  priceValue:   { fontSize: 30, fontWeight: '800', color: colors.oliDarkGray },
  pricePeriod:  { fontSize: 15, color: colors.gray },
  taxaRow:      { fontSize: 13, color: colors.oliLightGray },

  cicloRow: {
    flexDirection:   'row',
    gap:             spacing.sm,
    backgroundColor: `${colors.gray}10`,
    borderRadius:    radius.md,
    padding:         4,
  },
  cicloBtn: {
    flex:            1,
    paddingVertical: 8,
    borderRadius:    radius.sm,
    alignItems:      'center',
  },
  cicloBtnText:       { fontSize: 13, fontWeight: '600', color: colors.gray },
  cicloBtnTextActive: { color: colors.white },

  annualBonusNote: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    backgroundColor:   `${colors.oliGreen}12`,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   6,
  },
  annualBonusText: { fontSize: 12, color: colors.oliGreen, fontWeight: '600', flex: 1 },

  commitNote: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing.xs,
    backgroundColor:  `${colors.oliGold}12`,
    borderRadius:     radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:  6,
  },
  commitNoteText: { fontSize: 12, color: colors.oliGold, fontWeight: '600', flex: 1 },

  // Benefícios
  categoryBlock: { gap: spacing.sm },
  categoryTitle: {
    fontSize:      10,
    fontWeight:    '700',
    color:         colors.oliLightGray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  2,
  },
  featureRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  featureIcon: { marginTop: 1, flexShrink: 0 },
  featureLabel: { fontSize: 13, color: colors.oliDarkGray, lineHeight: 19 },
  featureLabelLocked: { color: colors.gray },
  featureDetail:      { fontSize: 11, color: colors.oliLightGray, marginTop: 1 },

  // CTAs
  ctaStack: { gap: spacing.sm, marginTop: spacing.sm },
  ctaBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    borderRadius:    radius.md,
    paddingVertical: 13,
  },
  ctaBtnCurrent: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    borderRadius:    radius.md,
    paddingVertical: 13,
    backgroundColor: `${colors.oliGreen}12`,
    marginTop:       spacing.sm,
  },
  ctaBtnDisabled: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    borderRadius:    radius.md,
    paddingVertical: 13,
    backgroundColor: `${colors.gray}12`,
    marginTop:       spacing.sm,
  },
  ctaBtnTrial: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    borderRadius:    radius.md,
    paddingVertical: 11,
    borderWidth:     1.5,
  },
  ctaBtnTrialUsed: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    borderRadius:    radius.md,
    paddingVertical: 11,
    backgroundColor: `${colors.gray}10`,
  },
  ctaBtnTrialText: { fontSize: 13, fontWeight: '600' },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

  referralBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: `${colors.oliGold}15`,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     `${colors.oliGold}40`,
  },
  referralTitle: { fontSize: 14, fontWeight: '700', color: colors.oliDarkGray },
  referralDesc:  { fontSize: 12, color: colors.oliLightGray, marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIAL DISCLAIMER STYLES (separado para não poluir o StyleSheet principal)
// ─────────────────────────────────────────────────────────────────────────────

const trialStyles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    padding:         spacing.lg,
    paddingBottom:   spacing.xxl,
    gap:             spacing.md,
  },
  iconWrap: {
    alignSelf:       'center',
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: `${colors.oliGold}15`,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    spacing.xs,
  },
  title: {
    fontSize:   18,
    fontWeight: '700',
    color:      colors.oliDarkGray,
    textAlign:  'center',
  },
  intro: {
    fontSize:   13,
    color:      colors.oliLightGray,
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    backgroundColor: `${colors.oliGold}10`,
    borderRadius:  radius.sm,
    padding:       spacing.sm,
  },
  itemIcon: { marginTop: 1, flexShrink: 0 },
  itemText: {
    fontSize:   13,
    color:      colors.oliDarkGray,
    lineHeight: 20,
    flex:       1,
  },
  itemBold: { fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.sm,
  },
  cancelBtn: {
    flex:            1,
    paddingVertical: 13,
    borderRadius:    radius.md,
    alignItems:      'center',
    borderWidth:     1.5,
    borderColor:     colors.border,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.oliLightGray },
  confirmBtn: {
    flex:            2,
    paddingVertical: 13,
    borderRadius:    radius.md,
    alignItems:      'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
