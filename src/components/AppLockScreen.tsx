import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, spacing, radius } from '../theme/designSystem';

interface Props {
  onUnlock: () => Promise<boolean>;
}

export function AppLockScreen({ onUnlock }: Props) {
  // Tenta UMA VEZ ao montar. Se falhar/cancelar, espera o usuário tocar
  // o botão "Desbloquear" — evita loop infinito de prompts.
  const triedRef = useRef(false);

  // Iconografia/textos adaptados ao biométrico real do device:
  // - só facial (Face ID) → ícone de rosto, sem menção a digital
  // - com digital → ícone de digital
  const [hasFingerprint, setHasFingerprint] = useState(false);
  const [hasFacial,      setHasFacial]      = useState(false);

  useEffect(() => {
    LocalAuthentication.supportedAuthenticationTypesAsync()
      .then((types) => {
        setHasFingerprint(types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT));
        setHasFacial(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    const timer = setTimeout(() => { onUnlock(); }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Device só facial → tudo Face ID; com digital → digital.
  const facialOnly  = hasFacial && !hasFingerprint;
  const btnIcon     = facialOnly ? 'scan-outline' : 'finger-print-outline';
  const hintText    = facialOnly
    ? 'Use o Face ID para desbloquear'
    : (hasFacial ? 'Use a biometria do aparelho para desbloquear'
                 : 'Use a impressão digital para desbloquear');

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

        <TouchableOpacity
          style={styles.unlockBtn}
          onPress={onUnlock}
          accessibilityLabel="Desbloquear com biometria"
        >
          <Ionicons name={btnIcon} size={28} color={colors.white} />
          <Text style={styles.unlockText}>Desbloquear</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>{hintText}</Text>

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
