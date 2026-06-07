import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/designSystem';

interface Props {
  onUnlock: () => Promise<boolean>;
}

export function AppLockScreen({ onUnlock }: Props) {
  // Tenta UMA VEZ ao montar (Face ID nativo). Só mostra o botão verde de
  // "Desbloquear" SE o Face ID falhar/cancelar — caso normal de sucesso
  // exibe apenas a animação nativa, sem quadro verde no rodapé.
  const triedRef = useRef(false);
  const [showRetry, setShowRetry] = useState(false);

  const attempt = async () => {
    setShowRetry(false);
    const ok = await onUnlock();
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

        {/* Botão de retry só aparece após Face ID falhar/cancelar */}
        {showRetry && (
          <>
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => void attempt()}
              accessibilityLabel="Tentar desbloquear novamente"
            >
              <Ionicons name="lock-open-outline" size={26} color={colors.white} />
              <Text style={styles.unlockText}>Desbloquear</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Toque para tentar novamente</Text>
          </>
        )}

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.oliDarkGray,
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
    backgroundColor: `${colors.oliGreen}33`,
    borderWidth:     2,
    borderColor:     colors.oliGreen,
    justifyContent:  'center',
    alignItems:      'center',
  },
  title:    { fontSize: 22, fontWeight: '700', color: colors.white },
  subtitle: { fontSize: 14, color: `${colors.white}80`, textAlign: 'center' },

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
  hint:       { fontSize: 12, color: `${colors.white}50`, textAlign: 'center', paddingHorizontal: spacing.xl },
});
