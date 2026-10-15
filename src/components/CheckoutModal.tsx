/**
 * CheckoutModal — OLI Health Hub
 *
 * Modal de checkout para contratação de módulos.
 * Suporta Cartão de Crédito (padrão), PIX e Boleto.
 *
 * Fluxo:
 *   select → processing → pay → [polling] → success | error
 *
 * Cartão: abre a página hospedada do Asaas no browser (PCI compliant).
 * PIX:    exibe QR code + copia-e-cola + countdown de 30 min.
 * Boleto: exibe data de vencimento + botão para abrir no browser.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore }           from '../store/authStore';
import { CouponField }            from './CouponField';
import { colors, radius, shadows, spacing } from '../theme/designSystem';
import {
  BillingType,
  ModuleChargeResult,
  checkModuleActivation,
  createModuleCharge,
} from '../services/checkoutService';
import type { OLIModule } from '../models/modules';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
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
  {
    type:        'CREDIT_CARD',
    label:       'Cartão de Crédito',
    icon:        'card-outline',
    description: 'Pague com segurança na página do Asaas',
    recommended: true,
  },
  {
    type:        'PIX',
    label:       'PIX',
    icon:        'qr-code-outline',
    description: 'QR Code válido por 30 minutos',
    recommended: false,
  },
  {
    type:        'BOLETO_BANCARIO',
    label:       'Boleto Bancário',
    icon:        'barcode-outline',
    description: 'Vencimento em 3 dias úteis',
    recommended: false,
  },
];

const PIX_TIMEOUT_S = 30 * 60; // 30 minutos
const POLL_INTERVAL = 5_000;   // 5 segundos

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function CheckoutModal({
  visible,
  onClose,
  module,
}: {
  visible: boolean;
  onClose: () => void;
  module:  OLIModule;
}) {
  const user = useAuthStore((s) => s.user);

  const [phase,       setPhase]       = useState<Phase>('select');
  const [billing,     setBilling]     = useState<BillingType>('CREDIT_CARD');
  const [cpfCnpj,     setCpfCnpj]     = useState('');
  const [result,      setResult]      = useState<ModuleChargeResult | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [secondsLeft, setSecondsLeft] = useState(PIX_TIMEOUT_S);
  const [copied,      setCopied]      = useState(false);
  const [couponCode,  setCouponCode]  = useState<string | null>(null);

  const pollTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset completo ao abrir / fechar
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
    return () => {
      clearIntervals();
    };
  }, [visible]);

  // ── helpers ────────────────────────────────────────────────────────────────

  const clearIntervals = () => {
    if (pollTimer.current)      { clearInterval(pollTimer.current);      pollTimer.current      = null; }
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
  };

  const startPolling = () => {
    if (!user?.id) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 120;  // ~10min cap
    pollTimer.current = setInterval(async () => {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        clearIntervals();
        setErrorMsg('Tempo de espera esgotado. Verifique seu pagamento e tente novamente.');
        setPhase('error');
        return;
      }
      const activated = await checkModuleActivation(module.id, user.id!);
      if (activated) {
        clearIntervals();
        setPhase('success');
      }
    }, POLL_INTERVAL);
  };

  const startCountdown = () => {
    countdownTimer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearIntervals();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleConfirm = async () => {
    setPhase('processing');
    try {
      const charge = await createModuleCharge(
        module.id,
        billing,
        cpfCnpj.trim() || undefined,
        couponCode ?? undefined,
      );
      setResult(charge);

      if (billing === 'CREDIT_CARD' && charge.invoiceUrl) {
        await Linking.openURL(charge.invoiceUrl);
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

  const handleRetry = () => {
    clearIntervals();
    setPhase('select');
    setErrorMsg('');
  };

  const handleClose = () => {
    clearIntervals();
    onClose();
  };

  // ── formatters ─────────────────────────────────────────────────────────────

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatDueDate = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatPrice = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {phase === 'success' ? 'Módulo Ativado!' :
             phase === 'error'   ? 'Pagamento com Erro' :
             'Contratar Módulo'}
          </Text>
          {(phase === 'select' || phase === 'error' || phase === 'success') && (
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityLabel="Fechar modal"
            >
              <Ionicons name="close" size={22} color={colors.oliDarkGray} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ══════════════════════════ FASE: SELECT ══════════════════════════ */}
          {phase === 'select' && (
            <>
              {/* Resumo do módulo */}
              <View style={[styles.moduleSummary, shadows.small]}>
                <View style={styles.moduleSummaryRow}>
                  <View>
                    <Text style={styles.moduleName}>{module.name}</Text>
                    <Text style={styles.moduleProvider}>{module.provider}</Text>
                  </View>
                  <Text style={styles.modulePrice}>{module.pricing.displayLabel}</Text>
                </View>
                <Text style={styles.moduleTagline}>{module.tagline}</Text>
              </View>

              {/* Métodos de pagamento */}
              <Text style={styles.sectionLabel}>Forma de pagamento</Text>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.type}
                  style={[styles.methodCard, billing === m.type && styles.methodCardSelected]}
                  onPress={() => setBilling(m.type)}
                  activeOpacity={0.8}
                  accessibilityLabel={`Selecionar ${m.label}`}
                >
                  <View style={[styles.methodIconWrap, billing === m.type && styles.methodIconSelected]}>
                    <Ionicons
                      name={m.icon as never}
                      size={22}
                      color={billing === m.type ? colors.white : colors.oliGreen}
                    />
                  </View>
                  <View style={styles.methodInfo}>
                    <View style={styles.methodLabelRow}>
                      <Text style={[styles.methodLabel, billing === m.type && styles.methodLabelSelected]}>
                        {m.label}
                      </Text>
                      {m.recommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedText}>Recomendado</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.methodDesc}>{m.description}</Text>
                  </View>
                  <Ionicons
                    name={billing === m.type ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={billing === m.type ? colors.oliGreen : colors.border}
                  />
                </TouchableOpacity>
              ))}

              {/* CPF — necessário para PIX/Boleto em produção */}
              {(billing === 'PIX' || billing === 'BOLETO_BANCARIO') && (
                <View style={styles.cpfSection}>
                  <Text style={styles.sectionLabel}>CPF / CNPJ</Text>
                  <TextInput
                    style={styles.cpfInput}
                    value={cpfCnpj}
                    onChangeText={setCpfCnpj}
                    placeholder="000.000.000-00"
                    placeholderTextColor={colors.gray}
                    keyboardType="numeric"
                    maxLength={18}
                    accessibilityLabel="CPF ou CNPJ para pagamento"
                  />
                  <Text style={styles.cpfHint}>
                    Necessário para PIX e Boleto em produção.
                  </Text>
                </View>
              )}

              {/* Cupom de desconto */}
              {module.pricing.amount !== undefined && user?.id && (
                <View style={styles.couponSection}>
                  <CouponField
                    targetType="modulo"
                    baseValue={module.pricing.amount}
                    professionalId={user.id}
                    onApplied={(code) => setCouponCode(code)}
                  />
                </View>
              )}

              {/* CTA */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                accessibilityLabel="Confirmar pagamento"
              >
                <Ionicons name="lock-closed" size={16} color={colors.white} />
                <Text style={styles.confirmBtnText}>
                  Confirmar Pagamento
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                accessibilityLabel="Cancelar compra"
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ════════════════════════ FASE: PROCESSING ════════════════════════ */}
          {phase === 'processing' && (
            <View style={styles.centeredBlock}>
              <ActivityIndicator size="large" color={colors.oliGreen} />
              <Text style={styles.processingText}>Processando…</Text>
              <Text style={styles.processingSubtext}>
                Estamos criando seu pagamento com segurança.
              </Text>
            </View>
          )}

          {/* ═══════════════════════════ FASE: PAY ════════════════════════════ */}
          {phase === 'pay' && result && (
            <>
              {/* ── Cartão de Crédito ── */}
              {billing === 'CREDIT_CARD' && (
                <>
                  <View style={styles.payIconBlock}>
                    <View style={[styles.payIconCircle, { backgroundColor: `${colors.oliGreen}15` }]}>
                      <Ionicons name="card" size={40} color={colors.oliGreen} />
                    </View>
                    <Text style={styles.payTitle}>Página de pagamento aberta</Text>
                    <Text style={styles.paySubtext}>
                      Complete o pagamento na página segura do Asaas. Após confirmar,
                      retorne ao app — ativaremos seu módulo automaticamente.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.openLinkBtn}
                    onPress={handleOpenCard}
                    accessibilityLabel="Abrir página de pagamento"
                  >
                    <Ionicons name="open-outline" size={16} color={colors.oliGreen} />
                    <Text style={styles.openLinkText}>Abrir página de pagamento</Text>
                  </TouchableOpacity>

                  <View style={styles.pollingRow}>
                    <ActivityIndicator size="small" color={colors.oliGold} />
                    <Text style={styles.pollingText}>Aguardando confirmação do pagamento…</Text>
                  </View>
                </>
              )}

              {/* ── PIX ── */}
              {billing === 'PIX' && (
                <>
                  <View style={styles.payIconBlock}>
                    <Text style={styles.payTitle}>Pague com PIX</Text>
                    <Text style={styles.pixAmount} accessibilityLabel={`Valor do PIX ${formatPrice(result.value)}`}>
                      {formatPrice(result.value)}
                    </Text>
                    {secondsLeft > 0 ? (
                      <View style={styles.countdownRow}>
                        <Ionicons name="time-outline" size={15} color={colors.oliGold} />
                        <Text style={styles.countdown}>
                          Válido por {formatCountdown(secondsLeft)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.countdownExpired}>QR Code expirado</Text>
                    )}
                  </View>

                  {result.pixQrCode ? (
                    <View style={styles.qrWrapper}>
                      <Image
                        source={{ uri: `data:image/png;base64,${result.pixQrCode}` }}
                        style={styles.qrImage}
                        accessibilityLabel="QR Code PIX"
                      />
                    </View>
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <Ionicons name="qr-code-outline" size={60} color={colors.gray} />
                      <Text style={styles.qrPlaceholderText}>QR Code indisponível</Text>
                    </View>
                  )}

                  {result.pixCopiaECola && (
                    <>
                      <Text style={styles.sectionLabel}>PIX Copia e Cola</Text>
                      <View style={styles.pixCodeBox}>
                        <Text style={styles.pixCode} numberOfLines={2} selectable>
                          {result.pixCopiaECola}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.copyBtn, copied && styles.copyBtnDone]}
                        onPress={handleCopyPix}
                        accessibilityLabel="Copiar código PIX"
                      >
                        <Ionicons
                          name={copied ? 'checkmark' : 'copy-outline'}
                          size={16}
                          color={copied ? colors.white : colors.oliGreen}
                        />
                        <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>
                          {copied ? 'Copiado!' : 'Copiar código'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <View style={styles.pollingRow}>
                    <ActivityIndicator size="small" color={colors.oliGold} />
                    <Text style={styles.pollingText}>Aguardando confirmação do pagamento…</Text>
                  </View>
                </>
              )}

              {/* ── Boleto ── */}
              {billing === 'BOLETO_BANCARIO' && (
                <>
                  <View style={styles.payIconBlock}>
                    <View style={[styles.payIconCircle, { backgroundColor: `${colors.oliGold}15` }]}>
                      <Ionicons name="document-text" size={40} color={colors.oliGold} />
                    </View>
                    <Text style={styles.payTitle}>Boleto Gerado</Text>
                    {result.dueDate && (
                      <Text style={styles.paySubtext}>
                        Vencimento: {formatDueDate(result.dueDate)}
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.openLinkBtn}
                    onPress={handleOpenBoleto}
                    accessibilityLabel="Abrir boleto bancário"
                  >
                    <Ionicons name="open-outline" size={16} color={colors.oliGold} />
                    <Text style={[styles.openLinkText, { color: colors.oliGold }]}>Abrir Boleto</Text>
                  </TouchableOpacity>

                  <View style={styles.pollingRow}>
                    <ActivityIndicator size="small" color={colors.oliGold} />
                    <Text style={styles.pollingText}>Aguardando confirmação do pagamento…</Text>
                  </View>
                </>
              )}
            </>
          )}

          {/* ══════════════════════════ FASE: SUCCESS ═════════════════════════ */}
          {phase === 'success' && (
            <View style={styles.centeredBlock}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={48} color={colors.white} />
              </View>
              <Text style={styles.successTitle}>Módulo Ativado!</Text>
              <Text style={styles.successSub}>{module.name} está pronto para uso.</Text>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleClose}
                accessibilityLabel="Fechar e voltar ao app"
              >
                <Ionicons name="checkmark-outline" size={18} color={colors.white} />
                <Text style={styles.confirmBtnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══════════════════════════ FASE: ERROR ══════════════════════════ */}
          {phase === 'error' && (
            <View style={styles.centeredBlock}>
              <View style={styles.errorCircle}>
                <Ionicons name="close" size={40} color={colors.white} />
              </View>
              <Text style={styles.errorTitle}>Erro no Pagamento</Text>
              <Text style={styles.errorMsg}>{errorMsg}</Text>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleRetry}
                accessibilityLabel="Tentar novamente"
              >
                <Text style={styles.confirmBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                accessibilityLabel="Fechar"
              >
                <Text style={styles.cancelBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.oliBackground,
  },

  // ── header ──
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.md,
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      colors.oliDarkGray,
    flex:       1,
  },
  closeBtn: {
    padding: spacing.xs,
  },

  // ── scroll ──
  scroll: {
    padding:     spacing.md,
    paddingBottom: spacing.xxl,
    gap:         spacing.md,
  },

  // ── module summary ──
  moduleSummary: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    gap:             spacing.xs,
  },
  moduleSummaryRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            spacing.sm,
  },
  moduleName:     { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },
  moduleProvider: { fontSize: 12, color: colors.oliLightGray, marginTop: 2 },
  modulePrice:    { fontSize: 15, fontWeight: '700', color: colors.oliGreen, flexShrink: 0 },
  moduleTagline:  { fontSize: 13, color: colors.gray, lineHeight: 18 },

  // ── section label ──
  sectionLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.oliLightGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },

  // ── payment method cards ──
  methodCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     2,
    borderColor:     colors.border,
  },
  methodCardSelected: {
    borderColor: colors.oliGreen,
    backgroundColor: `${colors.oliGreen}08`,
  },
  methodIconWrap: {
    width:          44,
    height:         44,
    borderRadius:   radius.md,
    backgroundColor: `${colors.oliGreen}15`,
    justifyContent: 'center',
    alignItems:     'center',
    flexShrink:     0,
  },
  methodIconSelected: {
    backgroundColor: colors.oliGreen,
  },
  methodInfo: {
    flex: 1,
    gap:  3,
  },
  methodLabelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    flexWrap:      'wrap',
  },
  methodLabel:         { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  methodLabelSelected: { color: colors.oliGreen },
  methodDesc:          { fontSize: 12, color: colors.gray },
  recommendedBadge: {
    backgroundColor: `${colors.oliGold}20`,
    borderRadius:    radius.full,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  recommendedText: { fontSize: 10, fontWeight: '700', color: colors.oliGold },

  // ── CPF ──
  cpfSection: { gap: spacing.xs },
  couponSection: { marginTop: spacing.sm },
  cpfInput: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize:        16,
    color:           colors.oliDarkGray,
  },
  cpfHint: { fontSize: 12, color: colors.gray },

  // ── action buttons ──
  confirmBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
    backgroundColor: colors.oliGreen,
    borderRadius:   radius.lg,
    paddingVertical: 15,
    marginTop:      spacing.xs,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  cancelBtn: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.oliLightGray },

  // ── processing ──
  centeredBlock: {
    alignItems:   'center',
    paddingVertical: spacing.xxl,
    gap:          spacing.lg,
  },
  processingText:    { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  processingSubtext: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },

  // ── pay phase shared ──
  payIconBlock: {
    alignItems: 'center',
    gap:        spacing.sm,
    paddingVertical: spacing.md,
  },
  payIconCircle: {
    width:          80,
    height:         80,
    borderRadius:   40,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   spacing.xs,
  },
  payTitle:   { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray },
  pixAmount:  { fontSize: 28, fontWeight: '800', color: colors.oliGreen, marginTop: spacing.xs },
  paySubtext: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },

  openLinkBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
    borderWidth:    2,
    borderColor:    colors.oliGreen,
    borderRadius:   radius.lg,
    paddingVertical: 13,
  },
  openLinkText: { fontSize: 15, fontWeight: '700', color: colors.oliGreen },

  pollingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: `${colors.oliGold}1A`,
    borderRadius:   radius.md,
  },
  pollingText: { fontSize: 13, color: colors.oliGold, fontWeight: '600' },

  // ── PIX ──
  countdownRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  countdown:        { fontSize: 16, fontWeight: '700', color: colors.oliGold },
  countdownExpired: { fontSize: 14, fontWeight: '700', color: colors.oliRed },

  qrWrapper: {
    alignItems:     'center',
    backgroundColor: colors.white,
    borderRadius:   radius.lg,
    padding:        spacing.md,
    ...shadows.card,
  },
  qrImage: { width: 220, height: 220 },

  qrPlaceholder: {
    alignItems: 'center',
    gap:        spacing.sm,
    paddingVertical: spacing.xl,
  },
  qrPlaceholderText: { fontSize: 13, color: colors.gray },

  pixCodeBox: {
    backgroundColor: `${colors.oliDarkGray}08`,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  pixCode: {
    fontSize:    12,
    color:       colors.oliDarkGray,
    fontFamily:  'monospace',
    lineHeight:  18,
  },
  copyBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
    borderWidth:    2,
    borderColor:    colors.oliGreen,
    borderRadius:   radius.lg,
    paddingVertical: 11,
  },
  copyBtnDone: {
    backgroundColor: colors.oliGreen,
    borderColor:     colors.oliGreen,
  },
  copyBtnText:     { fontSize: 14, fontWeight: '700', color: colors.oliGreen },
  copyBtnTextDone: { color: colors.white },

  // ── success ──
  successCircle: {
    width:          88,
    height:         88,
    borderRadius:   44,
    backgroundColor: colors.oliGreen,
    justifyContent: 'center',
    alignItems:     'center',
  },
  successTitle: { fontSize: 22, fontWeight: '700', color: colors.oliDarkGray },
  successSub:   { fontSize: 15, color: colors.gray, textAlign: 'center' },

  // ── error ──
  errorCircle: {
    width:          88,
    height:         88,
    borderRadius:   44,
    backgroundColor: colors.oliRed,
    justifyContent: 'center',
    alignItems:     'center',
  },
  errorTitle: { fontSize: 22, fontWeight: '700', color: colors.oliDarkGray },
  errorMsg:   { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },
});
