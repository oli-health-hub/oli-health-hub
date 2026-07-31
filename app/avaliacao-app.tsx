import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/store/authStore';
import { creditOlicoins } from '../src/services/olicoinsService';
import { colors, spacing, radius } from '../src/theme/designSystem';

const SCORES = Array.from({ length: 11 }, (_, i) => i); // 0..10

export default function AvaliacaoAppScreen() {
  const router  = useRouter();
  const profile = useAuthStore(s => s.profile);

  const [checking,  setChecking]  = useState(true);
  const [alreadySent, setAlreadySent] = useState(false);
  const [score,     setScore]     = useState<number | null>(null);
  const [comment,   setComment]   = useState('');
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);

  useEffect(() => {
    (async () => {
      if (!profile?.id) { setChecking(false); return; }
      const { data } = await supabase
        .from('app_satisfaction_responses')
        .select('id')
        .eq('professional_id', profile.id)
        .limit(1)
        .maybeSingle();
      setAlreadySent(!!data);
      setChecking(false);
    })();
  }, [profile?.id]);

  const handleSubmit = async () => {
    if (score === null || !profile?.id) return;
    setSending(true);
    try {
      await supabase.from('app_satisfaction_responses').insert({
        professional_id: profile.id,
        score,
        comment: comment.trim() || null,
      });
      await creditOlicoins(profile.id, 'avaliacao_app', 10);
      setSent(true);
    } catch {
      // Falha silenciosa — não é ação crítica, usuário pode tocar de novo depois.
    } finally {
      setSending(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <View style={styles.centerFill}>
            <ActivityIndicator color={colors.oliGreen} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (alreadySent || sent) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.centerFill}>
            <Ionicons name="heart" size={40} color={colors.oliGreen} />
            <Text style={styles.thanksTitle}>
              {sent ? 'Obrigado pela avaliação!' : 'Você já avaliou o OLI, obrigado!'}
            </Text>
            {sent && <Text style={styles.thanksSubtitle}>Você ganhou 10 Olicoins 🪙</Text>}
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} accessibilityLabel="Fechar">
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.content}>
            <Text style={styles.title}>Como está sendo sua experiência no OLI?</Text>
            <Text style={styles.subtitle}>De 0 a 10, o quanto você recomendaria o OLI para um colega?</Text>

            <View style={styles.scoreRow}>
              {SCORES.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.scoreCircle, score === n && styles.scoreCircleActive]}
                  onPress={() => setScore(n)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: score === n }}
                  accessibilityLabel={`Nota ${n}`}
                >
                  <Text style={[styles.scoreText, score === n && styles.scoreTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.scoreLabels}>
              <Text style={styles.scoreLabelText}>Não recomendaria</Text>
              <Text style={styles.scoreLabelText}>Recomendaria muito</Text>
            </View>

            <Text style={[styles.question, styles.questionSpacing]}>
              Quer contar mais? <Text style={styles.optionalHint}>(opcional)</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="O que está bom ou poderia melhorar..."
              placeholderTextColor={colors.gray}
              value={comment}
              onChangeText={setComment}
              multiline
              accessibilityLabel="Comentário sobre sua experiência"
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitBtn, (score === null || sending) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={score === null || sending}
              accessibilityLabel="Enviar avaliação"
            >
              {sending
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.submitBtnText}>Enviar avaliação · +10 🪙</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oliBackground },
  flex: { flex: 1, justifyContent: 'space-between' },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  content: { padding: spacing.lg },

  title:    { fontSize: 22, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.oliLightGray, marginBottom: spacing.lg, lineHeight: 20 },

  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  scoreCircle: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreCircleActive: { backgroundColor: colors.oliGreen, borderColor: colors.oliGreen },
  scoreText:       { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray },
  scoreTextActive: { color: colors.white },
  scoreLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  scoreLabelText: { fontSize: 11, color: colors.oliLightGray },

  question:      { fontSize: 15, fontWeight: '600', color: colors.oliDarkGray },
  questionSpacing: { marginTop: spacing.lg },
  optionalHint:  { fontSize: 12, fontWeight: '400', color: colors.oliLightGray },
  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15,
    color: colors.oliDarkGray, backgroundColor: colors.white,
    marginTop: spacing.sm, minHeight: 90, textAlignVertical: 'top',
  },

  footer: { padding: spacing.lg },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.oliGreen, borderRadius: radius.md, paddingVertical: 16,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

  thanksTitle:    { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center' },
  thanksSubtitle: { fontSize: 14, color: colors.oliLightGray, textAlign: 'center' },
  closeBtn: {
    marginTop: spacing.md, backgroundColor: colors.oliGreen, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.xl,
  },
  closeBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
