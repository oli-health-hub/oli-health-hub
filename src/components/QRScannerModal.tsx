import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/designSystem';

// QR codes emitidos pelo totem OLI começam com este prefixo.
// Fase 3: validar também o token assinado pelo Communicare.
const OLI_QR_PREFIX     = 'OLI-CHECKOUT';
// Código digitável tem prefixo curto: OLI-XXXX-YYYY (sala-token)
const MANUAL_CODE_REGEX = /^OLI-[A-Z0-9]{1,4}-\d{4}$/i;

interface Props {
  onCheckout: () => void;
  onClose:    () => void;
}

export function QRScannerModal({ onCheckout, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error,   setError]   = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!permission?.granted && !permission?.canAskAgain) return;
    if (!permission?.granted) requestPermission();
  }, []);

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    if (data.startsWith(OLI_QR_PREFIX)) {
      onCheckout();
    } else {
      setError('QR Code não reconhecido. Use o totem da recepção ou da copa.');
    }
  };

  const resetScan = () => {
    setScanned(false);
    setError('');
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim().toUpperCase();
    if (!MANUAL_CODE_REGEX.test(code)) {
      setError('Código inválido. Formato esperado: OLI-XXXX-1234');
      return;
    }
    setError('');
    onCheckout();
  };

  // ── Sem permissão ─────────────────────────────────────────────────────────
  if (!permission) {
    return <PermissionScreen loading onClose={onClose} onRequest={requestPermission} />;
  }

  if (!permission.granted) {
    return (
      <PermissionScreen
        loading={false}
        denied={!permission.canAskAgain}
        onClose={onClose}
        onRequest={requestPermission}
      />
    );
  }

  // ── Modo manual (sem câmera) ──────────────────────────────────────────────
  if (manualMode) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.manualContainer}
      >
        <View style={[styles.manualHeader, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity
            onPress={() => { setManualMode(false); setError(''); }}
            accessibilityLabel="Voltar ao scanner"
          >
            <Ionicons name="arrow-back" size={24} color={colors.oliDarkGray} />
          </TouchableOpacity>
          <Text style={styles.manualTitle}>Digite o código</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Cancelar checkout">
            <Ionicons name="close" size={24} color={colors.oliDarkGray} />
          </TouchableOpacity>
        </View>

        <View style={styles.manualBody}>
          <Ionicons name="keypad-outline" size={48} color={colors.oliGreen} />
          <Text style={styles.manualLabel}>Código exibido no totem</Text>
          <Text style={styles.manualHint}>
            Digite a sequência mostrada na tela da recepção (ex.: OLI-S1-7892)
          </Text>

          <TextInput
            style={styles.manualInput}
            value={manualCode}
            onChangeText={t => { setManualCode(t.toUpperCase()); setError(''); }}
            placeholder="OLI-XXXX-1234"
            placeholderTextColor={colors.oliLightGray}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={13}
            accessibilityLabel="Código de checkout"
          />

          {error ? (
            <View style={styles.manualErrorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.oliRed} />
              <Text style={styles.manualErrorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.manualBtn, !manualCode && styles.manualBtnDisabled]}
            disabled={!manualCode}
            onPress={handleManualSubmit}
            accessibilityLabel="Confirmar checkout"
          >
            <Text style={styles.manualBtnText}>Confirmar checkout</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Scanner ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Checkout — QR Code</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cancelar checkout">
          <Ionicons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraWrapper}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        />

        {/* Overlay com recorte */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.oliRed} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={resetScan} style={styles.retryBtn}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.hint}>
                Aponte para o QR Code no totem da recepção ou da copa
              </Text>
            )}

            {/* Fallback: digitar código manualmente */}
            <TouchableOpacity
              style={styles.manualLink}
              onPress={() => { setManualMode(true); setError(''); setManualCode(''); }}
              accessibilityLabel="Digitar código manualmente"
            >
              <Ionicons name="keypad-outline" size={16} color={colors.white} />
              <Text style={styles.manualLinkText}>Digitar código manualmente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Tela de permissão ─────────────────────────────────────────────────────────

function PermissionScreen({
  loading, denied, onClose, onRequest,
}: {
  loading: boolean;
  denied?: boolean;
  onClose: () => void;
  onRequest: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.permContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.permClose} onPress={onClose} accessibilityLabel="Fechar">
        <Ionicons name="close" size={24} color={colors.oliDarkGray} />
      </TouchableOpacity>

      <Ionicons name="camera-outline" size={64} color={colors.oliGreen} />
      <Text style={styles.permTitle}>
        {loading ? 'Aguardando permissão…' : 'Acesso à câmera necessário'}
      </Text>
      <Text style={styles.permSub}>
        {denied
          ? 'A permissão foi negada. Ative o acesso à câmera em Ajustes > OLI Health Hub.'
          : 'Para fazer o checkout via QR Code, o app precisa acessar a câmera do dispositivo.'}
      </Text>

      {!loading && (
        denied ? (
          <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permBtnText}>Abrir Ajustes</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.permBtn} onPress={onRequest}>
            <Text style={styles.permBtnText}>Permitir acesso à câmera</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FRAME_SIZE = 300;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    backgroundColor:   'rgba(0,0,0,0.6)',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.white },

  cameraWrapper: { flex: 1 },

  // Overlay semitransparente com recorte central
  overlay:       { ...StyleSheet.absoluteFillObject },
  overlayTop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayMiddle: { flexDirection: 'row', height: FRAME_SIZE },
  overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayBottom: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems:      'center',
    justifyContent:  'flex-start',
    paddingTop:      spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  // Moldura com cantos verdes
  frame: { width: FRAME_SIZE, height: FRAME_SIZE },
  corner: {
    position:  'absolute',
    width:     CORNER_SIZE,
    height:    CORNER_SIZE,
    borderColor: colors.oliGreen,
  },
  cornerTL: { top: 0, left: 0,  borderTopWidth: CORNER_THICKNESS, borderLeftWidth:  CORNER_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: 0, left: 0,  borderBottomWidth: CORNER_THICKNESS, borderLeftWidth:  CORNER_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },

  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  errorBox: { alignItems: 'center', gap: spacing.sm },
  errorText: { color: colors.white, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn:  { marginTop: spacing.xs, backgroundColor: colors.oliGreen, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // Link "Digitar código manualmente" no scanner
  manualLink: {
    marginTop:       spacing.lg,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.3)',
  },
  manualLinkText: { color: colors.white, fontSize: 13, fontWeight: '600' },

  // Tela modo manual
  manualContainer: { flex: 1, backgroundColor: colors.oliBackground },
  manualHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor:   colors.white,
  },
  manualTitle: { fontSize: 17, fontWeight: '700', color: colors.oliDarkGray },
  manualBody: {
    flex:           1,
    alignItems:     'center',
    paddingTop:     spacing.xl,
    paddingHorizontal: spacing.xl,
    gap:            spacing.md,
  },
  manualLabel: { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray, marginTop: spacing.sm },
  manualHint:  { fontSize: 13, color: colors.gray, textAlign: 'center', lineHeight: 18 },
  manualInput: {
    width:           '100%',
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.oliGreen,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    fontSize:        22,
    fontWeight:      '700',
    color:           colors.oliDarkGray,
    textAlign:       'center',
    letterSpacing:   3,
    marginTop:       spacing.md,
  },
  manualErrorBox: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:    radius.md,
  },
  manualErrorText: { color: colors.oliRed, fontSize: 13, flex: 1 },
  manualBtn: {
    width:           '100%',
    backgroundColor: colors.oliGreen,
    paddingVertical: spacing.md,
    borderRadius:    radius.md,
    alignItems:      'center',
    marginTop:       spacing.lg,
  },
  manualBtnDisabled: { opacity: 0.4 },
  manualBtnText:     { color: colors.white, fontSize: 15, fontWeight: '700' },

  // Permissão
  permContainer: { flex: 1, backgroundColor: colors.oliBackground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  permClose:     { position: 'absolute', top: spacing.lg, right: spacing.md },
  permTitle:     { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center' },
  permSub:       { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },
  permBtn:       { backgroundColor: colors.oliGreen, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  permBtnText:   { color: colors.white, fontWeight: '700', fontSize: 15 },
});
