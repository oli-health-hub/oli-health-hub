import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMFAVerify } from '../src/hooks/useMFA';
import { colors, spacing, radius } from '../src/theme/designSystem';
import { supabase } from '../src/services/supabase';

export default function MFAVerifyScreen() {
  const router = useRouter();
  const { status, error, verify } = useMFAVerify();
  const [code, setCode] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert('Código inválido', 'O código deve ter 6 dígitos.');
      return;
    }
    const ok = await verify(code);
    if (ok) {
      router.replace('/');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const loading = status === 'loading';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        <View style={styles.header}>
          <TouchableOpacity onPress={handleSignOut} accessibilityLabel="Cancelar e sair">
            <Text style={styles.cancelText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={48} color={colors.oliGreen} />
          </View>

          <Text style={styles.title}>Verificação em duas etapas</Text>
          <Text style={styles.subtitle}>
            Abra o app autenticador e insira o código de 6 dígitos para acessar o OLI.
          </Text>

          <TextInput
            ref={inputRef}
            style={styles.codeInput}
            value={code}
            onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.gray}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            textAlign="center"
            accessibilityLabel="Código de verificação de 6 dígitos"
          />

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.oliRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, (loading || code.length !== 6) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading || code.length !== 6}
            accessibilityLabel="Verificar código MFA"
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.btnText}>Verificar</Text>
            }
          </TouchableOpacity>

          <Text style={styles.hint}>
            O código é gerado a cada 30 segundos no app autenticador (Google Authenticator, Authy, etc.)
          </Text>
        </KeyboardAvoidingView>

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  header:  { padding: spacing.md, alignItems: 'flex-end' },
  cancelText: { fontSize: 15, color: colors.oliRed, fontWeight: '600' },

  content: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: spacing.xl,
    gap:             spacing.md,
  },
  iconWrap: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: `${colors.oliGreen}15`,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    spacing.sm,
  },
  title:    { fontSize: 22, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20 },

  codeInput: {
    width:           200,
    borderWidth:     2,
    borderColor:     colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
    fontSize:        32,
    fontWeight:      '700',
    color:           colors.oliDarkGray,
    backgroundColor: colors.white,
    letterSpacing:   8,
    marginTop:       spacing.sm,
  },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  errorText:{ fontSize: 13, color: colors.oliRed },

  btn: {
    width:           200,
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  btnDisabled: { backgroundColor: `${colors.gray}60` },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  hint: { fontSize: 12, color: colors.gray, textAlign: 'center', lineHeight: 18, marginTop: spacing.sm },
});
