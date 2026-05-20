import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signIn, signUp } from '../src/services/auth';
import { checkAuthRateLimit, recordAuthAttempt } from '../src/services/usageChargeService';
import { colors, spacing, radius, shadows } from '../src/theme/designSystem';

type Mode = 'login' | 'cadastro';

export default function LoginScreen() {
  const router = useRouter();

  const [mode,          setMode]         = useState<Mode>('login');
  const [nome,          setNome]         = useState('');
  const [email,         setEmail]        = useState('');
  const [password,      setPassword]     = useState('');
  const [showPassword,  setShowPassword] = useState(false);
  const [loading,       setLoading]      = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha e-mail e senha.');
      return;
    }
    if (mode === 'cadastro' && !nome.trim()) {
      Alert.alert('Campos obrigatórios', 'Informe seu nome.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        // Rate limiting: verifica tentativas antes de chamar o Supabase
        const rateCheck = await checkAuthRateLimit(email.trim());
        if (!rateCheck.allowed) {
          const blockedUntil = rateCheck.blockedUntil
            ? new Date(rateCheck.blockedUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : 'alguns minutos';
          Alert.alert(
            'Conta temporariamente bloqueada',
            `Muitas tentativas incorretas. Tente novamente após ${blockedUntil}.`,
          );
          return;
        }

        await signIn(email.trim(), password);
        // Registra sucesso (limpa histórico de falhas)
        recordAuthAttempt(email.trim(), true).catch(() => {});
      } else {
        await signUp(email.trim(), password, nome.trim());
        Alert.alert(
          'Conta criada!',
          'Verifique seu e-mail para confirmar o cadastro e depois faça login.',
          [{ text: 'OK', onPress: () => setMode('login') }],
        );
        return;
      }
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      // Registra falha para rate limiting
      if (mode === 'login') {
        recordAuthAttempt(email.trim(), false).catch(() => {});
      }
      Alert.alert('Erro', translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logoImage}
            accessibilityLabel="Logo OLI Health Hub"
          />
          <Text style={styles.logoTitle}>OLI Health Hub</Text>
          <Text style={styles.logoSub}>Plataforma do profissional de saúde</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>
            {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
          </Text>

          {mode === 'cadastro' && (
            <View style={styles.field}>
              <Text style={styles.label}>Nome completo</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Dr. João Silva"
                placeholderTextColor={colors.oliLightGray}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={colors.oliLightGray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'cadastro' ? 'Mínimo 6 caracteres' : '••••••••'}
                placeholderTextColor={colors.oliLightGray}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.oliLightGray}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityLabel={mode === 'login' ? 'Entrar' : 'Criar conta'}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.btnText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Alternar modo */}
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => setMode(m => m === 'login' ? 'cadastro' : 'login')}
          accessibilityLabel={mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
        >
          <Text style={styles.switchText}>
            {mode === 'login'
              ? 'Ainda não tem conta? '
              : 'Já tem uma conta? '}
            <Text style={styles.switchLink}>
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed'))       return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered'))   return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be'))        return 'A senha deve ter pelo menos 6 caracteres.';
  return msg;
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: colors.oliBackground },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },

  logoArea:  { alignItems: 'center', marginBottom: spacing.xl },
  logoImage: { width: 80, height: 80, resizeMode: 'contain', marginBottom: spacing.md },
  logoTitle: { fontSize: 26, fontWeight: '800', color: colors.oliDarkGray },
  logoSub:   { fontSize: 13, color: colors.oliLightGray, marginTop: 4 },

  card:      { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.lg },

  field: { marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '600', color: colors.gray, marginBottom: spacing.xs },
  input: {
    borderWidth:   1,
    borderColor:   colors.border,
    borderRadius:  radius.md,
    padding:       spacing.md,
    fontSize:      15,
    color:         colors.oliDarkGray,
    backgroundColor: colors.white,
  },
  passwordRow:  { flexDirection: 'row', alignItems: 'center' },
  passwordInput:{ flex: 1 },
  eyeBtn:       { position: 'absolute', right: spacing.md },

  btn:         { backgroundColor: colors.oliGreen, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  btnDisabled: { backgroundColor: colors.oliLightGray },
  btnText:     { color: colors.white, fontSize: 16, fontWeight: '700' },

  switchBtn:  { alignItems: 'center', paddingVertical: spacing.md },
  switchText: { fontSize: 14, color: colors.gray },
  switchLink: { color: colors.oliGreen, fontWeight: '700' },
});
