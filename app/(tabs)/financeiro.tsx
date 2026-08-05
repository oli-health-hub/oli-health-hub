import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Pressable,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { ScrollMoreIndicator } from '../../src/components/ScrollMoreIndicator';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import { formatCurrency } from '../../src/utils/formatters';
import { generateAndShareMonthlyReport } from '../../src/services/reportService';
import { useAuthStore } from '../../src/store/authStore';
import { COST_PER_MINUTE } from '../../src/store/appStore';
import {
  fetchUsageSummary,
  fetchMonthlyUsageHistory,
  fetchHourBalance,
  fetchHourPackages,
} from '../../src/services/financeiroService';
import type { UsageSummary, MonthlyUsageSummary, HourBalance } from '../../src/services/financeiroService';
import type { HourPackage } from '../../src/models/types';
import HourCheckoutModal from '../../src/components/HourCheckoutModal';

// ── Custo estimado de manter consultório próprio (aluguel + secretária + utilidades) ──
const TRADITIONAL_OFFICE_COST = 5_500.00;

// Dados dos serviços inclusos — usados apenas no PDF; a seção visual fica em Ecossistema
const INCLUDED_SERVICES = [
  { name: 'Recepção Assistida',  detail: 'Secretária compartilhada — 20 dias úteis', marketPrice: 2_500, unit: 'mês'     },
  { name: 'Consultoria Jurídica', detail: '1 de 3 consultas incluídas',              marketPrice:   350, unit: 'consulta' },
  { name: 'Consultoria Contábil', detail: '1 consulta incluída',                     marketPrice:   300, unit: 'consulta' },
  { name: 'Endereço Fiscal',      detail: 'CNPJ registrado no OLI',                  marketPrice:   150, unit: 'mês'     },
  { name: 'Internet Fibra 1 Gb',  detail: 'Uso nas salas',                           marketPrice:   120, unit: 'mês'     },
  { name: 'Evento OLI',           detail: '1 evento incluído / mês',                 marketPrice:   200, unit: 'evento'  },
];

// Valor de mercado dos serviços inclusos no plano (calculado em ecossistema.tsx)
const TOTAL_MARKET_VALUE = 3_620.00;


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
  const [showPackagePicker, setShowPackagePicker] = useState(false);
  const [hourPackages,      setHourPackages]      = useState<HourPackage[]>([]);
  const [hourBalance,       setHourBalance]       = useState<HourBalance | null>(null);
  const [showScrollHint,    setShowScrollHint]    = useState(true);

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

  // ── Saldo de pacote de horas ──
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    fetchHourBalance(userId).then(setHourBalance).catch(() => {});
  }, [session?.user?.id]);

  // ── Pacotes de horas (preço = taxa/min do plano atual × 60) ──
  useEffect(() => {
    const rate = COST_PER_MINUTE[profile?.plan as keyof typeof COST_PER_MINUTE] ?? COST_PER_MINUTE.START;
    fetchHourPackages(rate).then(setHourPackages).catch(() => {});
  }, [profile?.plan]);

  // ── Valores derivados (todos reais) ──
  const oliCost      = usageSummary?.totalValor   ?? 0;
  const totalMinutos = usageSummary?.totalMinutos ?? 0;
  const totalSessoes = usageSummary?.totalSessoes ?? 0;
  const horasH       = Math.floor(totalMinutos / 60);
  const horasMin     = totalMinutos % 60;
  const horasLabel   = totalMinutos > 0
    ? (horasMin > 0 ? `${horasH}h ${horasMin}min` : `${horasH}h`)
    : '—';
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

  const handleHourPackageSuccess = () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLoadingUsage(true);
    fetchUsageSummary(userId, currentYear, currentMonth)
      .then(setUsageSummary)
      .catch(() => {})
      .finally(() => setLoadingUsage(false));
    fetchHourBalance(userId).then(setHourBalance).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        scrollEventThrottle={100}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          setShowScrollHint(contentOffset.y + layoutMeasurement.height < contentSize.height - 60);
        }}
      >

        {/* ── Saldo de Horas ── */}
        <PacoteHoras
          consumed={hourBalance ? Math.floor(hourBalance.minutosUsados / 60) : 0}
          total={hourBalance ? Math.floor(hourBalance.minutosTotal / 60) : 0}
          hasPackage={hourBalance !== null}
          onBuyMore={() => setShowPackagePicker(true)}
        />

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

          {/* Serviços inclusos — valor agregado */}
          <View style={[styles.savingsCard, { borderColor: `${colors.oliGreen}30`, backgroundColor: `${colors.oliGreen}06` }]}>
            <View style={styles.savingsHeader}>
              <Ionicons name="gift-outline" size={16} color={colors.oliGreen} />
              <Text style={[styles.savingsTitle, { color: colors.oliGreen }]}>Valor em serviços inclusos</Text>
            </View>
            <View style={styles.savingsLines}>
              <View style={styles.savingsRow}>
                <Text style={styles.savingsLabel}>Serviços inclusos no plano</Text>
                <Text style={[styles.savingsTraditional, { color: colors.oliLightGray }]}>{formatCurrency(TOTAL_MARKET_VALUE)}/mês</Text>
              </View>
              <View style={styles.savingsRow}>
                <Text style={styles.savingsLabel}>Mensalidade do plano</Text>
                <Text style={styles.savingsOli}>{oliCost > 0 ? formatCurrency(oliCost) : '—'}</Text>
              </View>
            </View>
            {oliCost > 0 && TOTAL_MARKET_VALUE > oliCost && (
              <View style={styles.savingsResult}>
                <Ionicons name="checkmark-circle" size={18} color={colors.oliGreen} />
                <Text style={styles.savingsResultText}>
                  <Text style={styles.savingsHighlight}>{formatCurrency(TOTAL_MARKET_VALUE - oliCost)}</Text>
                  {' '}em valor incluso além do que pagou
                </Text>
              </View>
            )}
          </View>

          <View style={styles.roiPending}>
            <Ionicons name="stats-chart-outline" size={20} color={colors.oliLightGray} />
            <Text style={styles.roiPendingText}>
              Análise de ROI disponível com integração Communicare (em breve)
            </Text>
          </View>
        </View>

        {/* ── Pacotes de Horas ── */}
        <View
          onLayout={(e) => { packagesY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>Pacotes de Horas</Text>
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

      {/* Package picker modal */}
      <HourPackagePickerModal
        packages={hourPackages}
        visible={showPackagePicker}
        onClose={() => setShowPackagePicker(false)}
        onSelect={(pkg) => {
          setShowPackagePicker(false);
          setSelectedPackage(pkg);
        }}
      />

      {selectedPackage && (
        <HourCheckoutModal
          visible={!!selectedPackage}
          onClose={() => setSelectedPackage(null)}
          pkg={selectedPackage}
          onSuccess={handleHourPackageSuccess}
        />
      )}

      <ScrollMoreIndicator visible={showScrollHint} />
      </View>
    </SafeAreaView>
  );
}

// ── PacoteHoras ───────────────────────────────────────────────────────────────

function PacoteHoras({
  consumed, total, hasPackage, onBuyMore,
}: { consumed: number; total: number; hasPackage?: boolean; onBuyMore?: () => void }) {
  if (!hasPackage) {
    return (
      <View style={[pacoteStyles.card, shadows.card]}>
        <View style={pacoteStyles.emptyState}>
          <Ionicons name="time-outline" size={32} color={colors.oliGreen} style={{ marginBottom: 8 }} />
          <Text style={pacoteStyles.emptyTitle}>Sem pacote ativo</Text>
          <Text style={pacoteStyles.emptySubtitle}>Adquira horas para usar as salas OLI</Text>
          <TouchableOpacity
            style={pacoteStyles.buyBtn}
            onPress={onBuyMore}
            accessibilityLabel="Comprar horas"
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.white} />
            <Text style={pacoteStyles.buyBtnText}>Comprar horas</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const remaining = total - consumed;
  const progress  = total > 0 ? consumed / total : 0;
  const isLow     = remaining <= total * 0.2;

  return (
    <View style={[pacoteStyles.card, shadows.card]}>
      <View style={pacoteStyles.header}>
        <View style={pacoteStyles.titleRow}>
          <Ionicons name="time-outline" size={15} color={colors.oliGreen} />
          <Text style={pacoteStyles.title}>Saldo de Horas — Pacote {total}h</Text>
        </View>
        <TouchableOpacity onPress={onBuyMore} accessibilityLabel="Comprar mais horas">
          <Text style={pacoteStyles.addMore}>+ Comprar</Text>
        </TouchableOpacity>
      </View>

      <View style={pacoteStyles.track}>
        <View style={[
          pacoteStyles.fill,
          { width: `${Math.min(progress * 100, 100)}%` as any },
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
  card:          { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title:         { fontSize: 14, fontWeight: '700', color: colors.oliDarkGray },
  addMore:       { fontSize: 13, fontWeight: '700', color: colors.oliGold },
  track:         { height: 8, backgroundColor: `${colors.oliGreen}1A`, borderRadius: radius.full, overflow: 'hidden', marginBottom: spacing.sm },
  fill:          { height: 8, backgroundColor: colors.oliGreen, borderRadius: radius.full },
  fillLow:       { backgroundColor: colors.oliRed },
  stats:         { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem:      { alignItems: 'center', flex: 1 },
  statValue:     { fontSize: 20, fontWeight: '700', color: colors.oliGreen },
  statLabel:     { fontSize: 11, color: colors.gray, marginTop: 2 },
  statDivider:   { width: 1, height: 28, backgroundColor: colors.border },
  emptyState:    { alignItems: 'center', paddingVertical: spacing.lg },
  emptyTitle:    { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: colors.gray, marginBottom: spacing.md, textAlign: 'center' },
  buyBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.oliGreen, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.full },
  buyBtnText:    { fontSize: 14, fontWeight: '700', color: colors.white },
});

// ── HourPackagePickerModal ────────────────────────────────────────────────────

function HourPackagePickerModal({
  packages, visible, onClose, onSelect,
}: { packages: HourPackage[]; visible: boolean; onClose: () => void; onSelect: (pkg: HourPackage) => void }) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleContinue = () => {
    const pkg = packages.find(p => p.hours === selected);
    if (pkg) onSelect(pkg);
  };

  const pricePerHour = packages.length > 0 ? packages[0].price / packages[0].hours : 140;
  const hasBonus     = packages.some(p => p.bonusHours > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
        <Pressable style={pickerStyles.sheet} onPress={e => e.stopPropagation()} accessible={false}>

          <View style={pickerStyles.handle} />
          <View style={pickerStyles.header}>
            <View>
              <Text style={pickerStyles.title}>Escolha um pacote</Text>
              <Text style={pickerStyles.subtitle}>
                {formatCurrency(pricePerHour)}/h{hasBonus ? ' · pacotes maiores ganham horas bônus' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={colors.oliDarkGray} />
            </TouchableOpacity>
          </View>

          {packages.map((pkg, i) => {
            const isSelected = selected === pkg.hours;
            return (
              <TouchableOpacity
                key={pkg.hours}
                style={[
                  pickerStyles.row,
                  i < packages.length - 1 && pickerStyles.rowBorder,
                  isSelected && pickerStyles.rowSelected,
                ]}
                onPress={() => setSelected(pkg.hours)}
                accessibilityLabel={`Pacote ${pkg.hours} horas, ${formatCurrency(pkg.price)}`}
              >
                <View style={[pickerStyles.radio, isSelected && pickerStyles.radioSelected]}>
                  {isSelected && <View style={pickerStyles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={pickerStyles.pkgHours}>
                    <Text style={pickerStyles.pkgHoursNum}>{pkg.hours}</Text>
                    {' '}hora{pkg.hours > 1 ? 's' : ''}
                  </Text>
                  {pkg.bonusHours > 0 && (
                    <View style={pickerStyles.bonusBadge}>
                      <Ionicons name="gift-outline" size={11} color={colors.oliGreen} />
                      <Text style={pickerStyles.bonusText}>
                        +{pkg.bonusHours}h bônus · {pkg.hours + pkg.bonusHours}h no total
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={pickerStyles.pkgPrice}>{formatCurrency(pkg.price)}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[pickerStyles.continueBtn, !selected && pickerStyles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!selected}
            accessibilityLabel="Continuar para pagamento"
          >
            <Text style={pickerStyles.continueBtnText}>Continuar</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: 36, overflow: 'hidden' },
  handle:   { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md, paddingBottom: spacing.sm },
  title:    { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  subtitle: { fontSize: 12, color: colors.gray, marginTop: 2 },

  row:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  rowBorder:   { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowSelected: { backgroundColor: `${colors.oliGreen}08` },

  radio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  radioSelected: { borderColor: colors.oliGreen },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.oliGreen },

  pkgHours:    { fontSize: 14, color: colors.oliDarkGray, fontWeight: '400' },
  pkgHoursNum: { fontSize: 20, fontWeight: '800' },
  bonusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: `${colors.oliGreen}14`, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  bonusText:   { fontSize: 11, fontWeight: '600', color: colors.oliGreen },
  pkgPrice:    { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },

  continueBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.oliGreen, borderRadius: radius.md, paddingVertical: 14, marginHorizontal: spacing.md, marginTop: spacing.md },
  continueBtnDisabled: { backgroundColor: `${colors.gray}50` },
  continueBtnText:     { color: colors.white, fontSize: 16, fontWeight: '700' },
});

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
