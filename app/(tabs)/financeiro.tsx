import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadows } from '../../src/theme/designSystem';
import { formatCurrency } from '../../src/utils/formatters';
import { generateAndShareMonthlyReport } from '../../src/services/reportService';
import { useAuthStore } from '../../src/store/authStore';
import type { Invoice, HourPackage, InvoiceStatus } from '../../src/models/types';

// ── Mock — virão do Communicare + Supabase nas Fases 2 e 3 ───────────────────

const MONTHLY_STATS = {
  period:         'Maio 2026',
  grossRevenue:   18_500.00,   // total faturado aos pacientes
  consultations:  37,
  ticketMedio:    500.00,
  horasUtilizadas: 12,
  oliCost:        1_240.00,    // valor da fatura OLI deste mês
};

// Custo estimado de manter consultório próprio (aluguel + secretária + utilidades)
const TRADITIONAL_OFFICE_COST = 5_500.00;

const CURRENT_INVOICE: Invoice = {
  id:      'inv-current',
  period:  'Maio 2026',
  amount:  MONTHLY_STATS.oliCost,
  dueDate: '2026-05-10',
  status:  'pendente',
};

const PAST_INVOICES: Invoice[] = [
  { id: 'inv-3', period: 'Abril 2026',     amount: 1_150.00, dueDate: '2026-04-10', status: 'paga' },
  { id: 'inv-2', period: 'Março 2026',     amount:   980.00, dueDate: '2026-03-10', status: 'paga' },
  { id: 'inv-1', period: 'Fevereiro 2026', amount: 1_050.00, dueDate: '2026-02-10', status: 'paga' },
];

const HOUR_PACKAGES: HourPackage[] = [
  { hours: 10, price:   900.00, discountPercent: 10 },
  { hours: 20, price: 1_700.00, discountPercent: 15 },
  { hours: 50, price: 4_000.00, discountPercent: 20 },
];

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: colors.oliGold },
  paga:     { label: 'Paga',     color: colors.oliGreen },
  vencida:  { label: 'Vencida',  color: colors.oliRed },
};

// ── Serviços inclusos no plano ────────────────────────────────────────────────

type ServiceItem = {
  icon:        string;
  name:        string;
  detail:      string;       // ex: "1 de 3 utilizadas"
  used:        boolean;      // false = disponível mas não usado no mês
  marketPrice: number;       // o que custaria contratar por fora
  unit:        string;       // "mês" | "consulta" | "evento"
};

const INCLUDED_SERVICES: ServiceItem[] = [
  {
    icon:        'people-outline',
    name:        'Recepção Assistida',
    detail:      'Secretária compartilhada — 20 dias úteis',
    used:        true,
    marketPrice: 2_500.00,
    unit:        'mês',
  },
  {
    icon:        'document-text-outline',
    name:        'Consultoria Jurídica',
    detail:      '1 de 3 consultas utilizadas',
    used:        true,
    marketPrice: 350.00,
    unit:        'consulta',
  },
  {
    icon:        'calculator-outline',
    name:        'Consultoria Contábil',
    detail:      '0 de 1 consulta — disponível',
    used:        false,
    marketPrice: 300.00,
    unit:        'consulta',
  },
  {
    icon:        'location-outline',
    name:        'Endereço Fiscal',
    detail:      'CNPJ registrado no OLI',
    used:        true,
    marketPrice: 150.00,
    unit:        'mês',
  },
  {
    icon:        'wifi-outline',
    name:        'Internet Fibra 1 Gb',
    detail:      '12h de uso nas salas',
    used:        true,
    marketPrice: 120.00,
    unit:        'mês',
  },
  {
    icon:        'star-outline',
    name:        'Evento OLI',
    detail:      '0 de 1 evento — disponível',
    used:        false,
    marketPrice: 200.00,
    unit:        'evento',
  },
];

const totalMarketValue   = INCLUDED_SERVICES.reduce((acc, s) => acc + s.marketPrice, 0);
const servicesSaving     = totalMarketValue - MONTHLY_STATS.oliCost;   // economia bruta

// ── Derivados gerais ──────────────────────────────────────────────────────────

const netRevenue   = MONTHLY_STATS.grossRevenue - MONTHLY_STATS.oliCost;
const savings      = TRADITIONAL_OFFICE_COST - MONTHLY_STATS.oliCost;
const oliPercent   = ((MONTHLY_STATS.oliCost / MONTHLY_STATS.grossRevenue) * 100).toFixed(1);
const roiMultiple  = (MONTHLY_STATS.grossRevenue / MONTHLY_STATS.oliCost).toFixed(1);

// ── Screen ────────────────────────────────────────────────────────────────────

export default function FinanceiroScreen() {
  const { profile } = useAuthStore();
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const handleGeneratePDF = async () => {
    setGeneratingPDF(true);
    try {
      await generateAndShareMonthlyReport({
        period:          MONTHLY_STATS.period,
        doctorName:      profile?.nome ?? 'Profissional',
        crm:             profile?.crm ?? '',
        plan:            'PRO',
        grossRevenue:    MONTHLY_STATS.grossRevenue,
        consultations:   MONTHLY_STATS.consultations,
        horasUtilizadas: MONTHLY_STATS.horasUtilizadas,
        taxaMin:         1.60,
        oliCost:         MONTHLY_STATS.oliCost,
        invoiceHistory:  PAST_INVOICES.map(i => ({
          period:  i.period,
          amount:  i.amount,
          status:  i.status,
        })),
        includedServices: INCLUDED_SERVICES.map(s => ({
          name:        s.name,
          detail:      s.detail,
          marketPrice: s.marketPrice,
          unit:        s.unit,
          used:        s.used,
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

  const handlePayInvoice = () => {
    Alert.alert(
      'Pagar Fatura',
      'O pagamento será processado pela recepção do OLI via Communicare.',
    );
  };

  const handleBuyPackage = (pkg: HourPackage) => {
    Alert.alert(
      `Pacote de ${pkg.hours} Horas`,
      `${formatCurrency(pkg.price)} com ${pkg.discountPercent}% de desconto.\n\nDeseja solicitar este pacote?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Solicitar', onPress: () =>
          Alert.alert('Solicitação Enviada', 'A recepção do OLI processará seu pacote em breve.'),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Faturamento do Mês ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Faturamento · {MONTHLY_STATS.period}</Text>
            <View style={styles.consultBadge}>
              <Ionicons name="people-outline" size={13} color={colors.oliGreen} />
              <Text style={styles.consultBadgeText}>{MONTHLY_STATS.consultations} consultas</Text>
            </View>
          </View>

          <Text style={styles.revenueAmount}>{formatCurrency(MONTHLY_STATS.grossRevenue)}</Text>

          <View style={styles.statsRow}>
            <StatPill icon="time-outline" label="Horas OLI" value={`${MONTHLY_STATS.horasUtilizadas}h`} />
            <StatPill icon="receipt-outline" label="Ticket médio" value={formatCurrency(MONTHLY_STATS.ticketMedio)} />
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
              <Text style={styles.pdfBtnText}>Gerar Extrato PDF — {MONTHLY_STATS.period}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Vale a Pena Estar no OLI? ── */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Vale a pena estar no OLI?</Text>
            <Ionicons name="trending-up" size={20} color={colors.oliGreen} />
          </View>

          {/* Receita líquida */}
          <View style={styles.roiLines}>
            <RoiLine
              label="Você faturou"
              value={formatCurrency(MONTHLY_STATS.grossRevenue)}
              valueColor={colors.oliDarkGray}
            />
            <RoiLine
              label="Custo OLI (plano + horas)"
              value={`- ${formatCurrency(MONTHLY_STATS.oliCost)}`}
              valueColor={colors.oliGold}
            />
            <View style={styles.roiDivider} />
            <RoiLine
              label="Receita líquida"
              value={formatCurrency(netRevenue)}
              valueColor={colors.oliGreen}
              bold
            />
          </View>

          {/* Economia vs. consultório próprio */}
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
                <Text style={styles.savingsLabel}>Você paga no OLI</Text>
                <Text style={styles.savingsOli}>{formatCurrency(MONTHLY_STATS.oliCost)}/mês</Text>
              </View>
            </View>
            <View style={styles.savingsResult}>
              <Ionicons name="checkmark-circle" size={18} color={colors.oliGreen} />
              <Text style={styles.savingsResultText}>
                Economia de <Text style={styles.savingsHighlight}>{formatCurrency(savings)}</Text> este mês
              </Text>
            </View>
          </View>

          {/* ROI resumido */}
          <View style={styles.roiSummaryRow}>
            <View style={styles.roiSummaryItem}>
              <Text style={styles.roiSummaryValue}>{roiMultiple}x</Text>
              <Text style={styles.roiSummaryLabel}>Retorno sobre{'\n'}o investimento</Text>
            </View>
            <View style={styles.roiSummaryDivider} />
            <View style={styles.roiSummaryItem}>
              <Text style={styles.roiSummaryValue}>{oliPercent}%</Text>
              <Text style={styles.roiSummaryLabel}>Do faturamento{'\n'}vai para o OLI</Text>
            </View>
            <View style={styles.roiSummaryDivider} />
            <View style={styles.roiSummaryItem}>
              <Text style={styles.roiSummaryValue}>{formatCurrency(MONTHLY_STATS.grossRevenue / MONTHLY_STATS.horasUtilizadas)}</Text>
              <Text style={styles.roiSummaryLabel}>Faturado{'\n'}por hora OLI</Text>
            </View>
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
              style={[
                svcStyles.row,
                i < INCLUDED_SERVICES.length - 1 && svcStyles.rowBorder,
              ]}
            >
              <View style={[svcStyles.iconWrap, { opacity: svc.used ? 1 : 0.4 }]}>
                <Ionicons name={svc.icon as any} size={18} color={colors.oliGreen} />
              </View>
              <View style={svcStyles.info}>
                <Text style={[svcStyles.name, !svc.used && svcStyles.nameUnused]}>
                  {svc.name}
                </Text>
                <Text style={svcStyles.detail}>{svc.detail}</Text>
              </View>
              <View style={svcStyles.priceCol}>
                <Text style={svcStyles.marketPrice}>{formatCurrency(svc.marketPrice)}</Text>
                <Text style={svcStyles.priceUnit}>/{svc.unit}</Text>
              </View>
            </View>
          ))}

          {/* Rodapé da economia */}
          <View style={svcStyles.footer}>
            <View style={svcStyles.footerRow}>
              <Text style={svcStyles.footerLabel}>Valor de mercado destes serviços</Text>
              <Text style={svcStyles.footerMarket}>{formatCurrency(totalMarketValue)}/mês</Text>
            </View>
            <View style={svcStyles.footerRow}>
              <Text style={svcStyles.footerLabel}>Você paga no OLI (plano)</Text>
              <Text style={svcStyles.footerOli}>{formatCurrency(MONTHLY_STATS.oliCost)}/mês</Text>
            </View>
            <View style={svcStyles.savingsBanner}>
              <Ionicons name="checkmark-circle" size={18} color={colors.oliGreen} />
              <Text style={svcStyles.savingsBannerText}>
                {'Economia de '}
                <Text style={svcStyles.savingsBannerHighlight}>{formatCurrency(servicesSaving)}</Text>
                {' só em serviços inclusos'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Fatura Atual ── */}
        <Text style={styles.sectionTitle}>Fatura Atual</Text>

        <View style={[styles.invoiceCard, shadows.card]}>
          <View style={styles.invoiceTop}>
            <Text style={styles.invoiceLabel}>{CURRENT_INVOICE.period}</Text>
            <Text style={styles.invoiceDue}>Vence em 10/05</Text>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountPrefix}>R$</Text>
            <Text style={styles.amount}>
              {CURRENT_INVOICE.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.payBtn}
            onPress={handlePayInvoice}
            accessibilityLabel="Pagar fatura atual"
          >
            <Text style={styles.payBtnText}>Pagar Fatura</Text>
          </TouchableOpacity>
        </View>

        {/* ── Pacotes de Horas ── */}
        <Text style={styles.sectionTitle}>Pacotes de Horas</Text>

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

        {/* ── Histórico ── */}
        <Text style={styles.sectionTitle}>Histórico de Faturas</Text>

        <View style={styles.historyList}>
          {PAST_INVOICES.map(inv => {
            const cfg = STATUS_CONFIG[inv.status];
            return (
              <TouchableOpacity
                key={inv.id}
                style={[styles.historyRow, shadows.small]}
                onPress={() => Alert.alert(inv.period, `Valor: ${formatCurrency(inv.amount)}\nStatus: ${cfg.label}`)}
                accessibilityLabel={`Fatura de ${inv.period}, ${cfg.label}`}
              >
                <View>
                  <Text style={styles.historyPeriod}>{inv.period}</Text>
                  <Text style={styles.historyAmount}>{formatCurrency(inv.amount)}</Text>
                </View>
                <View style={styles.historyRight}>
                  <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}1A` }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={14} color={colors.gray} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>
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

function RoiLine({ label, value, valueColor, bold }: {
  label: string; value: string; valueColor: string; bold?: boolean;
}) {
  return (
    <View style={roiStyles.line}>
      <Text style={[roiStyles.label, bold && roiStyles.boldLabel]}>{label}</Text>
      <Text style={[roiStyles.value, { color: valueColor }, bold && roiStyles.boldValue]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pillStyles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    backgroundColor: `${colors.oliGreen}0F`,
    borderRadius:    radius.sm,
    paddingHorizontal: 10,
    paddingVertical:  6,
  },
  label: { fontSize: 12, color: colors.gray },
  value: { fontSize: 13, fontWeight: '700', color: colors.oliGreen },
});

const roiStyles = StyleSheet.create({
  line:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  label:     { fontSize: 14, color: colors.gray },
  value:     { fontSize: 14, fontWeight: '500' },
  boldLabel: { fontWeight: '700', color: colors.oliDarkGray, fontSize: 15 },
  boldValue: { fontWeight: '700', fontSize: 15 },
});

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },

  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
  },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  consultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.oliGreen}0F`, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  consultBadgeText: { fontSize: 12, fontWeight: '600', color: colors.oliGreen },

  revenueAmount: { fontSize: 38, fontWeight: '700', color: colors.oliGreen, marginBottom: spacing.md },

  statsRow: { flexDirection: 'row', gap: spacing.sm },

  // ROI card
  roiLines:    { marginBottom: spacing.md },
  roiDivider:  { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },

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

  roiSummaryRow:     { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  roiSummaryItem:    { alignItems: 'center', flex: 1 },
  roiSummaryValue:   { fontSize: 20, fontWeight: '700', color: colors.oliGreen },
  roiSummaryLabel:   { fontSize: 11, color: colors.gray, textAlign: 'center', marginTop: 2, lineHeight: 16 },
  roiSummaryDivider: { width: 1, height: 36, backgroundColor: colors.border },

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

  invoiceCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
  },
  invoiceTop:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  invoiceLabel: { fontSize: 16, fontWeight: '500', color: colors.oliDarkGray },
  invoiceDue:   { fontSize: 14, color: colors.gray },
  amountRow:    { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md },
  amountPrefix: { fontSize: 20, fontWeight: '700', color: colors.oliGreen, marginBottom: 4, marginRight: 4 },
  amount:       { fontSize: 36, fontWeight: '700', color: colors.oliGreen },
  payBtn:       { backgroundColor: colors.oliGreen, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  payBtnText:   { color: colors.white, fontSize: 16, fontWeight: '700' },

  packagesRow:  { marginBottom: spacing.xs },
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
  buyBtn:        { backgroundColor: `${colors.oliGreen}1A`, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
  buyBtnText:    { color: colors.oliGreen, fontSize: 14, fontWeight: '700' },

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
  nameUnused: { color: colors.gray },
  detail:     { fontSize: 12, color: colors.gray, marginTop: 2 },
  priceCol:   { alignItems: 'flex-end' },
  marketPrice:{ fontSize: 14, fontWeight: '700', color: colors.oliDarkGray },
  priceUnit:  { fontSize: 11, color: colors.gray },

  footer:       { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 },
  footerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel:  { fontSize: 13, color: colors.gray },
  footerMarket: { fontSize: 13, fontWeight: '600', color: colors.oliRed },
  footerOli:    { fontSize: 13, fontWeight: '600', color: colors.oliGreen },
  savingsBanner:{
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: `${colors.oliGreen}12`,
    borderRadius:    radius.sm,
    padding:         spacing.sm,
    marginTop:       4,
  },
  savingsBannerText:      { fontSize: 14, color: colors.oliDarkGray, flex: 1 },
  savingsBannerHighlight: { fontWeight: '700', color: colors.oliGreen },
});
