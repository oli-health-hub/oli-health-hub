import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/designSystem';

interface Props {
  onUnlock: (useDevicePasscode?: boolean) => Promise<boolean>;
}

export function AppLockScreen({ onUnlock }: Props) {
  // Tenta UMA VEZ ao montar (Face ID nativo). Só mostra o botão verde de
  // "Desbloquear" SE o Face ID falhar/cancelar — caso normal de sucesso
  // exibe apenas a animação nativa, sem quadro verde no rodapé.
  const triedRef = useRef(false);
  const [showRetry, setShowRetry] = useState(false);

  const attempt = async (useDevicePasscode = false) => {
    setShowRetry(false);
    const ok = await onUnlock(useDevicePasscode);
    if (!ok) setShowRetry(true);   // falhou/cancelou → oferece retry manual
  };

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    const timer = setTimeout(() => { void attempt(); }, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Ionicons name="lock-closed" size={32} color={colors.white} />
          </View>
          <Text style={styles.title}>OLI Health Hub</Text>
          <Text style={styles.subtitle}>Sessão bloqueada</Text>
        </View>

        {/* Retry só aparece após Face ID falhar/cancelar */}
        {showRetry && (
          <>
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => void attempt(false)}
              accessibilityLabel="Tentar Face ID novamente"
            >
              <Ionicons name="scan-outline" size={26} color={colors.white} />
              <Text style={styles.unlockText}>Tentar Face ID</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.passcodeBtn}
              onPress={() => void attempt(true)}
              accessibilityLabel="Usar código do dispositivo"
            >
              <Ionicons name="keypad-outline" size={20} color={colors.oliDarkGray} />
              <Text style={styles.passcodeText}>Usar código do dispositivo</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Ao usar o código do dispositivo, o próximo acesso pedirá seu e-mail e senha.
            </Text>
          </>
        )}

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    // Vidro fosco claro (identidade OLI) — translúcido mas opaco o bastante
    // para não vazar dados sensíveis atrás (LGPD). Blur real virá com expo-blur
    // no próximo build nativo.
    backgroundColor: 'rgba(244,239,234,0.96)',
    zIndex:          9999,
    justifyContent:  'center',
    alignItems:      'center',
    gap:             spacing.lg,
  },
  logoArea: { alignItems: 'center', gap: spacing.md },
  logoCircle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: colors.oliGreen,
    justifyContent:  'center',
    alignItems:      'center',
  },
  title:    { fontSize: 22, fontWeight: '700', color: colors.oliDarkGray },
  subtitle: { fontSize: 14, color: colors.oliLightGray, textAlign: 'center' },

  unlockBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop:       spacing.xl,
  },
  unlockText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  passcodeBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    borderWidth:     1,
    borderColor:     `${colors.oliDarkGray}33`,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop:       spacing.md,
  },
  passcodeText: { color: colors.oliDarkGray, fontSize: 14, fontWeight: '600' },
  hint:       { fontSize: 12, color: colors.oliLightGray, textAlign: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.sm },
});
