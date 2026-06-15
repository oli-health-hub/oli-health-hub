import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/services/supabase';
import { signOut } from '../src/services/auth';
import { colors, spacing, radius, typography } from '../src/theme/designSystem';

const MIN_PASSWORD = 8;

/**
 * Tela de definição de nova senha (fim do fluxo de recuperação).
 *
 * Chegada: o deep link de recovery (olihealthhub://nova-senha) é interceptado
 * em app/_layout.tsx, que faz setSession com os tokens e navega para cá.
 * Aqui o usuário define a nova senha via supabase.auth.updateUser.
 * Ao concluir, faz signOut → força login com a senha nova.
 */
export default function NovaSenhaScreen() {
  const router = useRouter();
  const [senha, setSenha]       = useState('');
  const [confirma, setConfirma] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSave = async () => {
    if (senha.length < MIN_PASSWORD) {
      Alert.alert('Senha curta', `A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (senha !== confirma) {
      Alert.alert('Senhas diferentes', 'A confirmação não coincide com a nova senha.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      await signOut();
      Alert.alert(
        'Senha redefinida',
        'Sua senha foi alterada. Entre novamente com a nova senha.',
        [{ text: 'OK', onPress: () => router.replace('/login') }],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao redefinir a senha';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Definir nova senha</Text>
        <Text style={styles.subtitle}>
          Escolha uma senha com pelo menos {MIN_PASSWORD} caracteres.
        </Text>

        <Text style={styles.label}>Nova senha</Text>
        <TextInput
          style={styles.input}
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor={colors.oliLightGray}
          accessibilityLabel="Nova senha"
        />

        <Text style={styles.label}>Confirmar senha</Text>
        <TextInput
          style={styles.input}
          value={confirma}
          onChangeText={setConfirma}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor={colors.oliLightGray}
          accessibilityLabel="Confirmar nova senha"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Salvar nova senha"
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.buttonText}>Salvar nova senha</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    justifyContent:  'center',
    padding:         spacing.lg,
    backgroundColor: colors.oliBackground,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
  },
  title: {
    fontSize:     typography.title2.fontSize,
    fontWeight:   '700',
    color:        colors.oliDarkGray,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize:     14,
    color:        colors.oliLightGray,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize:     13,
    fontWeight:   '600',
    color:        colors.oliDarkGray,
    marginBottom: spacing.xs,
    marginTop:    spacing.md,
  },
  input: {
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize:        16,
    color:           colors.oliDarkGray,
    backgroundColor: colors.white,
  },
  button: {
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.lg,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color:      colors.white,
    fontSize:   16,
    fontWeight: '700',
  },
});
