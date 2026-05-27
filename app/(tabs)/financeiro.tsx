import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import { formatCurrency } from '../../src/utils/formatters';
import { generateAndShareMonthlyReport } from '../../src/services/reportService';
import { useAuthStore } from '../../src/store/authStore';
import {
  fetchUsageSummary,
  fetchMonthlyUsageHistory,
} from '../../src/services/financeiroService';
import type { UsageSummary, MonthlyUsageSummary } from '../../src/services/financeiroService';
import type { HourPackage } from '../../src/models/types';
import HourCheckoutModal from '../../src/components/HourCheckoutModal';

// ── Custo estimado de manter consultório próprio (aluguel + secretária + utilidades) ──
const TRADITIONAL_OFFICE_COST = 5_500.00;

// Pacotes espelham exatamente a tabela hour_packages no Supabase
const HOUR_PACKAGES: HourPackage[] = [
  { hours:  1, price:   140.00, discountPercent:  0 },
  { hours: 10, price: 1_100.00, discountPercent: 21 }, // R$110/h vs R$140 base
  { hours: 20, price: 2_000.00, discountPercent: 29 }, // R$100/h
  { hours: 40, price: 3_600.00, discountPercent: 36 }, // R$90/h
];

// ── Serviços inclusos no plano (informativos — não variam por usuário) ──────────
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function FinanceiroScreen() {
  const { profile, session } = useAuthStore();
  const { section } = useLocalSearchParams<{ section?: string }>();

  const scrollViewRef = useRef<ScrollView>(null);
  const packagesY     = useRef(0);

  const [generatingPDF,    setGeneratingPDF]    = useState(false);
  const [usageSummary,     setUsageSummary]     = useState<UsageSummary | null>(null);
  const [loadingUsage,     setLoadingUsage]     = useState(true);
  const [monthlyHistory,   setMonthlyHistory]   = useState<MonthlyUsageSummary[]>([]);
  const [loadingHistory,   setLoadingHistory]   = useState(true);
  const [selectedPackage,  setSelectedPackage]  = useState<HourPackage | null>(null);

  // ── Scroll para seção de pacotes quando navegado com ?section=packages ──
  useEffect(() => {
    if (section !== 'packages') return;
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: packagesY.current, animated: true });
    }, 350);
    return () => clearTimeout(timeout);
  }, [section]);

  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentPeriod = now
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());

  // ── Dados reais de minutagem (mês atual) ──
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoadingUsage(true);
    fetchUsageSummary(userId, currentYear, currentMonth)
      .then(setUsageSummary)
      .catch(() => {})
      .finally(() => setLoadingUsage(false));
  }, [session?.user?.id, currentYear, currentMonth]);

  // ── Histórico dos últimos 3 meses ──
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoadingHistory(true);
    fetchMonthlyUsageHistory(userId, 3)
      .then(setMonthlyHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [session?.user?.id]);

  // ── Valores derivados (todos reais) ──
  const oliCost      = usageSummary?.totalValor   ?? 0;
  const totalMinutos = usageSummary?.totalMinutos ?? 0;
  const totalSessoes = usageSummary?.totalSessoes ?? 0;
  const horasH       = Math.floor(totalMinutos / 60);
  const horasMin     = totalMinutos % 60;
  const horasLabel   = totalMinutos > 0
    ? (horasMin > 0 ? `${horasH}h ${horasMin}min` : `${horasH}h`)
    : '—';
  const servicesSaving = totalMarketValue - oliCost;
  const savingsVsTrad  = TRADITIONAL_OFFICE_COST - oliCost;

  // ── Gerar PDF com dados reais ──
  const handleGeneratePDF = async () => {
    setGeneratingPDF(true);
    try {
      await generateAndShareMonthlyReport({
        period:          currentPeriod,
        doctorName:      profile?.nome ?? 'Profissional',
        crm:             profile?.crm  ?? '',
        plan:            profile?.plan ?? '—',
        grossRevenue:    0,           // Communicare — fase 3
        consultations:   0,
        horasUtilizadas: horasH,
        taxaMin:         oliCost > 0 && totalMinutos > 0 ? oliCost / totalMinutos : 0,
        oliCost,
        invoiceHistory:  monthlyHistory.map(m => ({
          period: m.period,
          amount: m.totalValor,
          status: 'paga' as const,
        })),
        includedServices: INCLUDED_SERVICES.map(s => ({
          name:        s.name,
          detail:      s.detail,
          marketPrice: s.marketPrice,
          unit:        s.unit,
          used:        true,
        })),
        traditionalOfficeCost: TRADITIONAL_OFFICE_COST,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      Alert.alert('Erro', `Não foi possível gerar o extrato.\n\n${msg}`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleBuyPackage = (pkg: HourPackage) => {
    setSelectedPackage(pkg);
  };

  const handleHourPackageSuccess = () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoadingUsage(true);
    fetchUsageSummary(userId, currentYear, currentMonth)
      .then(setUsageSummary)
      .catch(() => {})
      .finally(() => setLoadingUsage(false));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.content}>

        {/* ── Custo OLI este mês ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Custo OLI · {currentPeriod}</Text>
            {totalSessoes > 0 && (
              <View style={styles.consultBadge}>
                <Ionicons name="time-outline" size={13} color={colors.oliGreen} />
                <Text style={styles.consultBadgeText}>{totalSessoes} sessões</Text>
              </View>
            )}
          </View>

          {loadingUsage ? (
            <ActivityIndicator color={colors.oliGreen} style={{ marginVertical: spacing.md }} />
          ) : (
            <>
              <Text style={styles.revenueAmount}>{formatCurrency(oliCost)}</Text>
              <View style={styles.statsRow}>
                <StatPill icon="time-outline"    label="Horas utilizadas" value={horasLabel} />
                <StatPill icon="receipt-outline" label="Minutagem"        value={`R$ ${oliCost > 0 && totalMinutos > 0 ? (oliCost / totalMinutos).toFixed(2) : '—'}/min`} />
              </View>
              {oliCost === 0 && (
                <Text style={styles.zeroNote}>Nenhuma sessão registrada este mês.</Text>
              )}
            </>
          )}

          {/* Faturamento ao paciente — disponível com Communicare */}
          <View style={styles.phaseNotice}>
            <Ionicons name="information-circle-outline" size={14} color={colors.gray} />
            <Text style={styles.phaseNoticeText}>
              Faturamento ao paciente disponível com integração Communicare (em breve)
            </Text>
          </View>
        </View>

        {/* ── Botão Extrato PDF ── */}
        <TouchableOpacity
          style={[styles.pdfBtn, generatingPDF && styles.pdfBtnDisabled]}
          onPress={handleGeneratePDF}
          disabled={generatingPDF}
          accessibilityLabel="Gerar extrato mensal em PDF"
        >
          {generatingPDF ? (
            <>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.pdfBtnText}>Gerando PDF…</Text>
            </>
          ) : (
            <>
              <Ionicons name="document-text-outline" size={18} color={colors.white} />
              <Text style={styles.pdfBtnText}>Gerar Extrato PDF — {currentPeriod}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Vale a pena estar no OLI? ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Vale a pena estar no OLI?</Text>
            <Ionicons name="trending-up" size={20} color={colors.oliGreen} />
          </View>

          {/* Economia vs. consultório próprio — usando custo real de minutagem */}
          <View style={styles.savingsCard}>
            <View style={styles.savingsHeader}>
              <Ionicons name="business-outline" size={16} color={colors.oliGold} />
              <Text style={styles.savingsTitle}>Economia vs. consultório próprio</Text>
            </View>
            <View style={styles.savingsLines}>
              <View style={styles.savingsRow}>
                <Text style={styles.savingsLabel}>Custo estimado aluguel + equipe</Text>
                <Text style={styles.savingsTraditional}>{formatCurrency(TRADITIONAL_OFFICE_COST)}/mês</Text>
              </View>
              <View style={styles.savingsRow}>
                <Text style={styles.savingsLabel}>Você pagou no OLI este mês</Text>
                <Text style={styles.savingsOli}>{formatCurrency(oliCost)}/mês</Text>
              </View>
            </View>
            {savingsVsTrad > 0 && (
              <View style={styles.savingsResult}>
                <Ionicons name="checkmark-circle" size={18} color={colors.oliGreen} />
                <Text style={styles.savingsResultText}>
                  Economia de{' '}
                  <Text style={styles.savingsHighlight}>{formatCurrency(savingsVsTrad)}</Text>
                  {' '}este mês
                </Text>
              </View>
            )}
          </View>

          {/* Comparativo ROI — aguarda Communicare */}
          <View style={styles.roiPending}>
            <Ionicons name="stats-chart-outline" size={20} color={colors.oliLightGray} />
            <Text style={styles.roiPendingText}>
              Análise de ROI (retorno sobre faturamento) disponível com integração Communicare
            </Text>
          </View>
        </View>

        {/* ── Serviços Inclusos ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Serviços Inclusos no Plano</Text>
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
              <Text style={svcStyles.marketPrice}>{formatCurrency(svc.marketPrice)}/{svc.unit}</Text>
            </View>
          ))}

          <View style={svcStyles.footer}>
            <View style={svcStyles.footerRow}>
              <Text style={svcStyles.footerLabel}>Valor de mercado destes serviços</Text>
              <Text style={svcStyles.footerMarket}>{formatCurrency(totalMarketValue)}/mês</Text>
            </View>
            {oliCost > 0 && servicesSaving > 0 && (
              <View style={svcStyles.savingsBanner}>
                <Ionicons name="checkmark-circle" size={18} color={colors.oliGreen} />
                <Text style={svcStyles.savingsBannerText}>
                  {'Economia de '}
                  <Text style={svcStyles.savingsBannerHighlight}>{formatCurrency(servicesSaving)}</Text>
                  {' só em serviços inclusos este mês'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Pacotes de Horas ── */}
        <View
          style={styles.packagesSectionHeader}
          onLayout={(e) => { packagesY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>Pacotes de Horas</Text>
          <View style={styles.scrollHintBadge}>
            <Text style={styles.scrollHintText}>Deslize</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.oliGreen} />
          </View>
        </View>

        <View style={styles.packagesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packagesRow}>
            {HOUR_PACKAGES.map(pkg => (
              <View key={pkg.hours} style={[styles.packageCard, shadows.small]}>
                <Text style={styles.packageHours}>{pkg.hours} Horas</Text>
                <Text style={styles.packagePrice}>{formatCurrency(pkg.price)}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{pkg.discountPercent}% OFF</Text>
                </View>
                <TouchableOpacity
                  style={styles.buyBtn}
                  onPress={() => handleBuyPackage(pkg)}
                  accessibilityLabel={`Comprar pacote de ${pkg.hours} horas`}
                >
                  <Text style={styles.buyBtnText}>Comprar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={styles.packagesScrollFade} pointerEvents="none" />
        </View>

        {/* ── Extrato de Minutagem ── */}
        <Text style={styles.sectionTitle}>Minutagem — {currentPeriod}</Text>

        <View style={[styles.card, shadows.card]}>
          {loadingUsage ? (
            <ActivityIndicator size="small" color={colors.oliGreen} style={{ marginVertical: spacing.md }} />
          ) : usageSummary && usageSummary.totalSessoes > 0 ? (
            <>
              <View style={usageStyles.summary}>
                <View style={usageStyles.summaryItem}>
                  <Text style={usageStyles.summaryValue}>{usageSummary.totalSessoes}</Text>
                  <Text style={usageStyles.summaryLabel}>Sessões</Text>
                </View>
                <View style={usageStyles.summaryDivider} />
                <View style={usageStyles.summaryItem}>
                  <Text style={usageStyles.summaryValue}>{horasLabel}</Text>
                  <Text style={usageStyles.summaryLabel}>Total</Text>
                </View>
                <View style={usageStyles.summaryDivider} />
                <View style={usageStyles.summaryItem}>
                  <Text style={[usageStyles.summaryValue, { color: colors.oliGold }]}>
                    {formatCurrency(usageSummary.totalValor)}
                  </Text>
                  <Text style={usageStyles.summaryLabel}>Custo</Text>
                </View>
              </View>

              {usageSummary.charges.map((charge, i) => {
                const inicio  = new Date(charge.iniciado_em);
                const dataStr = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                const horaStr = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <View key={charge.id} style={[usageStyles.chargeRow, i > 0 && usageStyles.chargeRowBorder]}>
                    <View style={usageStyles.chargeLeft}>
                      <Text style={usageStyles.chargeDate}>{dataStr} às {horaStr}</Text>
                      {charge.room_name && (
                        <Text style={usageStyles.chargeRoom}>{charge.room_name}</Text>
                      )}
                    </View>
                    <View style={usageStyles.chargeRight}>
                      <Text style={usageStyles.chargeMinutes}>{charge.minutos} min</Text>
                      <Text style={usageStyles.chargeValue}>{formatCurrency(charge.valor_total)}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={usageStyles.emptyState}>
              <Ionicons name="time-outline" size={32} color={colors.oliLightGray} />
              <Text style={usageStyles.emptyText}>Nenhuma sessão registrada este mês.</Text>
            </View>
          )}
        </View>

        {/* ── Histórico de Minutagem (últimos 3 meses) ── */}
        <Text style={styles.sectionTitle}>Histórico de Minutagem</Text>

        <View style={styles.historyList}>
          {loadingHistory ? (
            <ActivityIndicator color={colors.oliGreen} />
          ) : monthlyHistory.length === 0 ? (
            <View style={[styles.card, shadows.card]}>
              <Text style={{ color: colors.gray, fontSize: 14, textAlign: 'center', padding: spacing.md }}>
                Sem histórico ainda.
              </Text>
            </View>
          ) : (
            monthlyHistory.map(m => (
              <View key={m.period} style={[styles.historyRow, shadows.small]}>
                <View>
                  <Text style={styles.historyPeriod}>{m.period}</Text>
                  <Text style={styles.historyAmount}>
                    {m.totalSessoes} sessão{m.totalSessoes !== 1 ? 'ões' : ''} · {formatCurrency(m.totalValor)}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <View style={[styles.statusBadge, { backgroundColor: `${colors.oliGreen}1A` }]}>
                    <Text style={[styles.statusText, { color: colors.oliGreen }]}>
                      {m.totalSessoes > 0 ? 'Com uso' : 'Sem uso'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {selectedPackage && (
        <HourCheckoutModal
          visible={!!selectedPackage}
          onClose={() => setSelectedPackage(null)}
          pkg={selectedPackage}
          onSuccess={handleHourPackageSuccess}
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatPill({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={pillStyles.container}>
      <Ionicons name={icon as any} size={14} color={colors.oliGreen} />
      <Text style={pillStyles.label}>{label}</Text>
      <Text style={pillStyles.value}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pillStyles = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   `${colors.oliGreen}0F`,
    borderRadius:      radius.sm,
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  label: { fontSize: 12, color: colors.gray },
  value: { fontSize: 13, fontWeight: '700', color: colors.oliGreen },
});

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },

  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
  },
  cardHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle:        { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  consultBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.oliGreen}0F`, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  consultBadgeText: { fontSize: 12, fontWeight: '600', color: colors.oliGreen },
  revenueAmount:    { fontSize: 38, fontWeight: '700', color: colors.oliGreen, marginBottom: spacing.md },
  statsRow:         { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  zeroNote:         { fontSize: 13, color: colors.gray, marginTop: spacing.sm },

  phaseNotice: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    marginTop:      spacing.md,
    paddingTop:     spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  phaseNoticeText: { fontSize: 12, color: colors.gray, flex: 1, lineHeight: 16 },

  // Savings card
  savingsCard: {
    backgroundColor: `${colors.oliGold}0A`,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     `${colors.oliGold}30`,
  },
  savingsHeader:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  savingsTitle:       { fontSize: 13, fontWeight: '700', color: colors.oliGold },
  savingsLines:       { gap: 4, marginBottom: spacing.sm },
  savingsRow:         { flexDirection: 'row', justifyContent: 'space-between' },
  savingsLabel:       { fontSize: 13, color: colors.gray },
  savingsTraditional: { fontSize: 13, fontWeight: '600', color: colors.oliRed },
  savingsOli:         { fontSize: 13, fontWeight: '600', color: colors.oliGreen },
  savingsResult:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  savingsResultText:  { fontSize: 14, color: colors.oliDarkGray },
  savingsHighlight:   { fontWeight: '700', color: colors.oliGreen },

  // ROI pending placeholder
  roiPending: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: colors.oliBackground,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  roiPendingText: { fontSize: 13, color: colors.gray, flex: 1, lineHeight: 18 },

  pdfBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.oliGold,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
  },
  pdfBtnDisabled: { backgroundColor: colors.oliLightGray },
  pdfBtnText:     { color: colors.white, fontSize: 15, fontWeight: '700' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray, marginTop: spacing.xs },

  packagesSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scrollHintBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${colors.oliGreen}12`, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  scrollHintText:  { fontSize: 12, fontWeight: '600', color: colors.oliGreen },

  packagesWrap:       { position: 'relative' },
  packagesRow:        { marginBottom: spacing.xs },
  packagesScrollFade: {
    position:        'absolute',
    right:           0,
    top:             0,
    bottom:          spacing.xs,
    width:           40,
    borderRadius:    radius.lg,
    backgroundColor: `${colors.oliBackground}CC`,
  },
  packageCard: {
    width:           160,
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginRight:     spacing.md,
  },
  packageHours:  { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.xs },
  packagePrice:  { fontSize: 16, fontWeight: '500', color: colors.oliGreen, marginBottom: spacing.sm },
  discountBadge: { alignSelf: 'flex-start', backgroundColor: colors.oliGold, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2, marginBottom: spacing.sm },
  discountText:  { color: colors.white, fontSize: 12, fontWeight: '700' },
  buyBtn:        { backgroundColor: colors.oliGreen, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
  buyBtnText:    { color: colors.white, fontSize: 14, fontWeight: '700' },

  historyList:   { gap: spacing.sm },
  historyRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  historyPeriod: { fontSize: 16, fontWeight: '500', color: colors.oliDarkGray },
  historyAmount: { fontSize: 14, color: colors.gray, marginTop: 2 },
  historyRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusBadge:   { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  statusText:    { fontSize: 13, fontWeight: '700' },
});

const svcStyles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12 },
  rowBorder:  { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  iconWrap:   { width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.oliGreen}12`, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  info:       { flex: 1 },
  name:       { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  detail:     { fontSize: 12, color: colors.gray, marginTop: 2 },
  marketPrice:{ fontSize: 13, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'right' },

  footer:              { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 },
  footerRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel:         { fontSize: 13, color: colors.gray },
  footerMarket:        { fontSize: 13, fontWeight: '600', color: colors.oliRed },
  savingsBanner:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${colors.oliGreen}12`, borderRadius: radius.sm, padding: spacing.sm, marginTop: 4 },
  savingsBannerText:   { fontSize: 14, color: colors.oliDarkGray, flex: 1 },
  savingsBannerHighlight: { fontWeight: '700', color: colors.oliGreen },
});

const usageStyles = StyleSheet.create({
  summary:        { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryItem:    { alignItems: 'center', flex: 1 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },
  summaryValue:   { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  summaryLabel:   { fontSize: 11, color: colors.gray, marginTop: 2 },

  chargeRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  chargeRowBorder: { borderTopWidth: 0.5, borderTopColor: colors.border },
  chargeLeft:      { flex: 1 },
  chargeDate:      { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray },
  chargeRoom:      { fontSize: 11, color: colors.gray, marginTop: 1 },
  chargeRight:     { alignItems: 'flex-end' },
  chargeMinutes:   { fontSize: 12, color: colors.gray },
  chargeValue:     { fontSize: 14, fontWeight: '700', color: colors.oliGold },

  emptyState: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyText:  { fontSize: 14, color: colors.gray, textAlign: 'center' },
});
