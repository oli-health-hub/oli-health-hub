import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/designSystem';

interface Props {
  onUnlock: () => Promise<boolean>;
}

export function AppLockScreen({ onUnlock }: Props) {
  // Tenta autenticar automaticamente ao exibir a tela
  useEffect(() => {
    const timer = setTimeout(() => { onUnlock(); }, 400);
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
          <Text style={styles.subtitle}>Sessão bloqueada por inatividade</Text>
        </View>

        <TouchableOpacity
          style={styles.unlockBtn}
          onPress={onUnlock}
          accessibilityLabel="Desbloquear com biometria"
        >
          <Ionicons name="finger-print-outline" size={28} color={colors.white} />
          <Text style={styles.unlockText}>Desbloquear</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Use Face ID, Touch ID ou a senha do dispositivo
        </Text>

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
