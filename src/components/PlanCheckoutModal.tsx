/**
 * PlanCheckoutModal — OLI Health Hub
 *
 * Modal de checkout para assinatura de plano (BASE / PRO / VIP).
 * Suporta PIX, Boleto e Cartão de Crédito.
 *
 * Fluxo: select → processing → pay → [polling] → success | error
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore }               from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/designSystem';
import {
  BillingType,
  SubscriptionResult,
  checkPlanActivation,
  createPlanSubscription,
} from '../services/checkoutService';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type Phase = 'select' | 'processing' | 'pay' | 'success' | 'error';

interface PaymentMethod {
  type:        BillingType;
  label:       string;
  icon:        string;
  description: string;
  recommended: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { type: 'CREDIT_CARD',    label: 'Cartão de Crédito', icon: 'card-outline',    description: 'Pague com segurança na página do Asaas', recommended: true  },
  { type: 'PIX',            label: 'PIX',               icon: 'qr-code-outline', description: 'QR Code válido por 30 minutos',           recommended: false },
  { type: 'BOLETO_BANCARIO',label: 'Boleto Bancário',   icon: 'barcode-outline', description: 'Vencimento em 3 dias úteis',              recommended: false },
];

const PIX_TIMEOUT_S = 30 * 60;
const POLL_INTERVAL = 5_000;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────

export default function PlanCheckoutModal({
  visible,
  onClose,
  onSuccess,
  planId,
  planName,
  ciclo,
  value,
}: {
  visible:   boolean;
  onClose:   () => void;
  onSuccess?: () => void;
  planId:    string;
  planName:  string;
  ciclo:     'MONTHLY' | 'YEARLY';
  value:     number;
}) {
  const user = useAuthStore((s) => s.user);

  const [phase,       setPhase]       = useState<Phase>('select');
  const [billing,     setBilling]     = useState<BillingType>('CREDIT_CARD');
  const [cpfCnpj,     setCpfCnpj]     = useState('');
  const [result,      setResult]      = useState<SubscriptionResult | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [secondsLeft, setSecondsLeft] = useState(PIX_TIMEOUT_S);
  const [copied,      setCopied]      = useState(false);

  const pollTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setPhase('select');
      setBilling('CREDIT_CARD');
      setCpfCnpj('');
      setResult(null);
      setErrorMsg('');
      setSecondsLeft(PIX_TIMEOUT_S);
      setCopied(false);
    }
    return () => clearIntervals();
  }, [visible]);

  const clearIntervals = () => {
    if (pollTimer.current)      { clearInterval(pollTimer.current);      pollTimer.current      = null; }
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
  };

  const startPolling = () => {
    if (!user?.id) return;
    // Cap em ~10 minutos (120 tentativas × 5s) — evita loop infinito
    // se o webhook do Asaas falhar ou o usuário abandonar o checkout.
    let attempts = 0;
    const MAX_ATTEMPTS = 120;
    pollTimer.current = setInterval(async () => {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        clearIntervals();
        setErrorMsg('Tempo de espera esgotado. Verifique seu pagamento e tente novamente.');
        setPhase('error');
        return;
      }
      const activated = await checkPlanActivation(user.id!);
      if (activated) {
        clearIntervals();
        setPhase('success');
        onSuccess?.();
      }
    }, POLL_INTERVAL);
  };

  const startCountdown = () => {
    countdownTimer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearIntervals(); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleConfirm = async () => {
    setPhase('processing');
    try {
      const sub = await createPlanSubscription(
        planId,
        ciclo,
        billing,
        cpfCnpj.trim() || undefined,
      );
      setResult(sub);

      if (billing === 'CREDIT_CARD' && sub.invoiceUrl) {
        await Linking.openURL(sub.invoiceUrl);
      }

      setPhase('pay');
      startPolling();
      if (billing === 'PIX') startCountdown();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido. Tente novamente.');
      setPhase('error');
    }
  };

  const handleCopyPix = async () => {
    if (!result?.pixCopiaECola) return;
    await Clipboard.setStringAsync(result.pixCopiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenBoleto = async () => {
    const url = result?.bankSlipUrl ?? result?.invoiceUrl;
    if (!url) return;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert('Erro', 'Não foi possível abrir o boleto.');
  };

  const handleOpenCard = async () => {
    const url = result?.invoiceUrl;
    if (!url) return;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert('Erro', 'Não foi possível abrir a página de pagamento.');
  };

  const formatPix = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const cicloLabel = ciclo === 'YEARLY' ? 'Anual' : 'Mensal';
  const valueLabel = `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Assinar Plano {planName}</Text>
            <Text style={s.headerSub}>{valueLabel} / {cicloLabel.toLowerCase()}</Text>
          </View>
          {phase !== 'processing' && (
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar">
              <Ionicons name="close" size={24} color={colors.oliDarkGray} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── PHASE: select ── */}
          {phase === 'select' && (
            <>
              <Text style={s.label}>Forma de pagamento</Text>
              {PAYMENT_METHODS.map((pm) => (
                <TouchableOpacity
                  key={pm.type}
                  style={[s.methodRow, billing === pm.type && s.methodRowActive]}
                  onPress={() => setBilling(pm.type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: billing === pm.type }}
                  accessibilityLabel={pm.label}
                >
                  <View style={[s.methodIcon, billing === pm.type && s.methodIconActive]}>
                    <Ionicons name={pm.icon as 'card-outline'} size={20}
                      color={billing === pm.type ? colors.white : colors.oliGreen} />
                  </View>
                  <View style={s.methodTexts}>
                    <View style={s.methodTitleRow}>
                      <Text style={[s.methodLabel, billing === pm.type && s.methodLabelActive]}>
                        {pm.label}
                      </Text>
                      {pm.recommended && (
                        <View style={s.recBadge}>
                          <Text style={s.recText}>Recomendado</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.methodDesc, billing === pm.type && s.methodDescActive]}>
                      {pm.description}
                    </Text>
                  </View>
                  {billing === pm.type && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.oliGreen} />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={[s.label, { marginTop: spacing.lg }]}>CPF / CNPJ (opcional)</Text>
              <TextInput
                style={s.input}
                placeholder="Preencher para emissão de NF"
                placeholderTextColor={colors.gray}
                value={cpfCnpj}
                onChangeText={setCpfCnpj}
                keyboardType="numeric"
                accessibilityLabel="CPF ou CNPJ"
              />

              <View style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryKey}>Plano</Text>
                  <Text style={s.summaryVal}>{planName}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryKey}>Período</Text>
                  <Text style={s.summaryVal}>{cicloLabel}</Text>
                </View>
                <View style={[s.summaryRow, s.summaryRowLast]}>
                  <Text style={s.summaryKey}>Valor</Text>
                  <Text style={[s.summaryVal, { color: colors.oliGreen, fontWeight: '700' }]}>
                    {valueLabel}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={s.confirmBtn}
                onPress={handleConfirm}
                accessibilityLabel={`Confirmar assinatura do plano ${planName}`}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
                <Text style={s.confirmBtnText}>Confirmar e Pagar</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── PHASE: processing ── */}
          {phase === 'processing' && (
            <View style={s.center}>
              <ActivityIndicator size="large" color={colors.oliGreen} />
              <Text style={s.processingText}>Gerando cobrança…</Text>
            </View>
          )}

          {/* ── PHASE: pay ── */}
          {phase === 'pay' && result && (
            <>
              {/* PIX */}
              {billing === 'PIX' && (
                <>
                  <View style={s.pixCard}>
                    <Text style={s.pixTitle}>QR Code PIX</Text>
                    {result.pixQrCode ? (
                      <Image
                        source={{ uri: `data:image/png;base64,${result.pixQrCode}` }}
                        style={s.qrImage}
                        accessibilityLabel="QR Code PIX"
                      />
                    ) : null}
                    <Text style={s.pixCountdown}>
                      Expira em {formatPix(secondsLeft)}
                    </Text>
                  </View>
                  {result.pixCopiaECola ? (
                    <TouchableOpacity
                      style={s.copyBtn}
                      onPress={handleCopyPix}
                      accessibilityLabel="Copiar código PIX"
                    >
                      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.white} />
                      <Text style={s.copyBtnText}>{copied ? 'Copiado!' : 'Copiar código PIX'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}

              {/* Boleto */}
              {billing === 'BOLETO_BANCARIO' && (
                <View style={s.boletoCard}>
                  <Ionicons name="barcode-outline" size={40} color={colors.oliGreen} />
                  <Text style={s.boletoTitle}>Boleto gerado</Text>
                  <Text style={s.boletoDesc}>
                    Vencimento: {result.dueDate}
                  </Text>
                  <TouchableOpacity
                    style={s.boletoBtn}
                    onPress={handleOpenBoleto}
                    accessibilityLabel="Abrir boleto bancário"
                  >
                    <Ionicons name="open-outline" size={18} color={colors.white} />
                    <Text style={s.boletoBtnText}>Abrir Boleto</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Cartão */}
              {billing === 'CREDIT_CARD' && (
                <View style={s.boletoCard}>
                  <Ionicons name="card-outline" size={40} color={colors.oliGreen} />
                  <Text style={s.boletoTitle}>Página de pagamento aberta</Text>
                  <Text style={s.boletoDesc}>
                    Complete o pagamento com cartão na página do Asaas.
                  </Text>
                  <TouchableOpacity
                    style={s.boletoBtn}
                    onPress={handleOpenCard}
                    accessibilityLabel="Reabrir página de pagamento"
                  >
                    <Ionicons name="open-outline" size={18} color={colors.white} />
                    <Text style={s.boletoBtnText}>Abrir novamente</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={s.pollingHint}>
                <ActivityIndicator size="small" color={colors.oliGreen} />
                <Text style={s.pollingText}>Aguardando confirmação do pagamento…</Text>
              </View>
            </>
          )}

          {/* ── PHASE: success ── */}
          {phase === 'success' && (
            <View style={s.center}>
              <View style={s.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color={colors.oliGreen} />
              </View>
              <Text style={s.successTitle}>Assinatura ativada!</Text>
              <Text style={s.successDesc}>
                Seu plano {planName} está ativo. Aproveite todos os benefícios do OLI.
              </Text>
              <TouchableOpacity
                style={s.confirmBtn}
                onPress={onClose}
                accessibilityLabel="Fechar"
              >
                <Text style={s.confirmBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PHASE: error ── */}
          {phase === 'error' && (
            <View style={s.center}>
              <Ionicons name="alert-circle" size={56} color={colors.oliRed} />
              <Text style={s.errorTitle}>Erro no pagamento</Text>
              <Text style={s.errorMsg}>{errorMsg}</Text>
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: colors.oliRed }]}
                onPress={() => setPhase('select')}
                accessibilityLabel="Tentar novamente"
              >
                <Text style={s.confirmBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.oliBackground },
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    padding:         spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.oliDarkGray },
  headerSub:   { fontSize: 13, color: colors.gray, marginTop: 2 },

  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },

  label: { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray, marginBottom: spacing.xs },

  methodRow: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         spacing.md,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    backgroundColor: colors.white,
    gap:             spacing.sm,
    marginBottom:    spacing.sm,
  },
  methodRowActive: { borderColor: colors.oliGreen },
  methodIcon:      { width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.oliGreen}15`, justifyContent: 'center', alignItems: 'center' },
  methodIconActive:{ backgroundColor: colors.oliGreen },
  methodTexts:     { flex: 1 },
  methodTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  methodLabel:     { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  methodLabelActive:{ color: colors.oliDarkGray },
  methodDesc:      { fontSize: 12, color: colors.gray, marginTop: 2 },
  methodDescActive:{ color: colors.oliLightGray },
  recBadge:        { backgroundColor: `${colors.oliGold}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  recText:         { fontSize: 10, fontWeight: '700', color: colors.oliGold },

  input: {
    borderWidth:     1.5,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    padding:         spacing.md,
    fontSize:        15,
    color:           colors.oliDarkGray,
    backgroundColor: colors.white,
    marginBottom:    spacing.sm,
  },

  summaryCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginBottom:    spacing.md,
    ...shadows.card,
  },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryKey:     { fontSize: 13, color: colors.gray },
  summaryVal:     { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray },

  confirmBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  processingText:{ fontSize: 15, color: colors.oliDarkGray, marginTop: spacing.md },

  pixCard:     { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, ...shadows.card, marginBottom: spacing.md },
  pixTitle:    { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.sm },
  qrImage:     { width: 200, height: 200, marginVertical: spacing.sm },
  pixCountdown:{ fontSize: 13, color: colors.gray, marginTop: spacing.xs },

  copyBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.oliGreen, borderRadius: radius.md, paddingVertical: 12, marginBottom: spacing.md },
  copyBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  boletoCard:  { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, ...shadows.card, marginBottom: spacing.md, gap: spacing.sm },
  boletoTitle: { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },
  boletoDesc:  { fontSize: 13, color: colors.gray, textAlign: 'center' },
  boletoBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.oliGreen, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg },
  boletoBtnText:{ fontSize: 14, fontWeight: '700', color: colors.white },

  pollingHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.md },
  pollingText: { fontSize: 13, color: colors.oliLightGray },

  successIcon: { marginBottom: spacing.md },
  successTitle:{ fontSize: 22, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center' },
  successDesc: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 22 },

  errorTitle:  { fontSize: 20, fontWeight: '700', color: colors.oliRed, textAlign: 'center' },
  errorMsg:    { fontSize: 13, color: colors.gray, textAlign: 'center', lineHeight: 20 },
});
