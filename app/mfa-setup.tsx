import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMFAEnroll } from '../src/hooks/useMFA';
import { colors, spacing, radius } from '../src/theme/designSystem';

export default function MFASetupScreen() {
  const router = useRouter();
  const { status, enrollData, error, startEnroll, verifyEnroll } = useMFAEnroll();
  const [code,     setCode]     = useState('');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => { startEnroll(); }, []);

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert('Código inválido', 'O código deve ter 6 dígitos.');
      return;
    }
    const ok = await verifyEnroll(code);
    if (ok) {
      Alert.alert(
        'MFA Ativado',
        'Verificação em duas etapas ativada com sucesso. Seu acesso está protegido.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  };

  const loading = status === 'loading';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Fechar">
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={40} color={colors.oliGreen} />
          </View>
          <Text style={styles.title}>Ativar verificação em duas etapas</Text>
          <Text style={styles.subtitle}>
            Proteja sua conta com um código gerado a cada 30 segundos no seu app autenticador.
          </Text>

          {/* Passo 1 */}
          <View style={styles.step}>
            <View style={styles.stepBadge}><Text style={styles.stepNum}>1</Text></View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Instale um app autenticador</Text>
              <Text style={styles.stepDesc}>
                Google Authenticator, Authy ou qualquer app compatível com TOTP.
              </Text>
            </View>
          </View>

          {/* Passo 2 — QR Code (layout centralizado, sem badge lateral) */}
          <View style={styles.step2Card}>
            <View style={styles.step2Header}>
              <View style={styles.stepBadge}><Text style={styles.stepNum}>2</Text></View>
              <Text style={styles.stepTitle}>Escaneie o QR Code</Text>
            </View>

            {loading || !enrollData ? (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator color={colors.oliGreen} />
              </View>
            ) : (
              <View style={styles.qrWrap}>
                <Image
                  source={{ uri: enrollData.qrCode }}
                  style={styles.qrImage}
                  accessibilityLabel="QR Code para configuração do MFA"
                />
              </View>
            )}

            {enrollData && (
              <TouchableOpacity
                style={styles.secretToggle}
                onPress={() => setShowSecret(v => !v)}
                accessibilityLabel="Mostrar código manual"
              >
                <Ionicons
                  name={showSecret ? 'eye-off-outline' : 'eye-outline'}
                  size={14}
                  color={colors.oliGreen}
                />
                <Text style={styles.secretToggleText}>
                  {showSecret ? 'Ocultar' : 'Ver'} código manual
                </Text>
              </TouchableOpacity>
            )}
            {showSecret && enrollData && (
              <View style={styles.secretBox}>
                <Text style={styles.secretLabel}>Código manual (TOTP secret)</Text>
                <Text style={styles.secretValue} selectable>{enrollData.secret}</Text>
              </View>
            )}
          </View>

          {/* Passo 3 — Verificar */}
          <View style={styles.step}>
            <View style={styles.stepBadge}><Text style={styles.stepNum}>3</Text></View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Confirme com o código gerado</Text>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={colors.gray}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                accessibilityLabel="Código de 6 dígitos do app autenticador"
              />
              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.oliRed} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, (loading || code.length !== 6) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading || code.length !== 6}
            accessibilityLabel="Ativar verificação em duas etapas"
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.btnText}>Ativar MFA</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.oliBackground },
  header:    { padding: spacing.md, alignItems: 'flex-end' },
  closeText: { fontSize: 15, color: colors.oliGreen, fontWeight: '600' },

  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.lg, alignItems: 'stretch' },

  iconWrap: {
    alignSelf:       'center',
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: `${colors.oliGreen}15`,
    justifyContent:  'center',
    alignItems:      'center',
  },
  title:    { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.gray, textAlign: 'center', lineHeight: 20 },

  // Passos 1 e 3: layout em linha com badge lateral
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: colors.oliGreen,
    justifyContent:  'center',
    alignItems:      'center',
    flexShrink:      0,
    marginTop:       2,
  },
  stepNum:   { color: colors.white, fontSize: 13, fontWeight: '700' },
  stepBody:  { flex: 1, gap: spacing.sm },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
  stepDesc:  { fontSize: 13, color: colors.gray, lineHeight: 18 },

  // Passo 2: card centralizado, QR em destaque
  step2Card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    alignItems:      'center',
    gap:             spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  step2Header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    alignSelf:     'flex-start',
  },

  qrPlaceholder: {
    width:           200,
    height:          200,
    backgroundColor: `${colors.oliGreen}08`,
    borderRadius:    radius.md,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.border,
  },
  qrWrap:  {
    borderRadius:    radius.md,
    overflow:        'hidden',
    alignSelf:       'center',
    padding:         8,
    backgroundColor: colors.white,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  qrImage: { width: 200, height: 200 },

  secretToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secretToggleText: { fontSize: 12, color: colors.oliGreen, fontWeight: '600' },
  secretBox:    { backgroundColor: `${colors.oliGreen}08`, borderRadius: radius.sm, padding: spacing.sm, gap: 4, width: '100%' },
  secretLabel:  { fontSize: 11, color: colors.gray, textAlign: 'center' },
  secretValue:  { fontSize: 12, fontWeight: '600', color: colors.oliDarkGray, letterSpacing: 2, textAlign: 'center' },

  codeInput: {
    borderWidth:     2,
    borderColor:     colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
    fontSize:        28,
    fontWeight:      '700',
    color:           colors.oliDarkGray,
    backgroundColor: colors.white,
    letterSpacing:   8,
    textAlign:       'center',
  },
  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorText: { fontSize: 12, color: colors.oliRed, flex: 1 },

  btn: {
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  btnDisabled: { backgroundColor: `${colors.gray}60` },
  btnText:     { color: colors.white, fontSize: 16, fontWeight: '700' },
});
