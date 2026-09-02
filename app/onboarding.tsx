import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Keyboard, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/store/authStore';
import { colors, spacing, radius } from '../src/theme/designSystem';
import { getPendingReferralCode, clearPendingReferralCode } from '../src/utils/referral';
import { creditOlicoins } from '../src/services/olicoinsService';
import type { Tratamento, TipoAtendimento, ObjetivoOli } from '../src/models/types';

// ─── Onboarding enxuto ────────────────────────────────────────────────────────
// Só o essencial pra identificar o profissional no Admin. O resto (atendimento,
// situação fiscal, financeiro, como conheceu...) vira missão gamificada dentro
// do app — ver app/completar-perfil.tsx e src/utils/profileSections.ts.

function OptionCard<T extends string>({
  label, value, selected, onPress, icon = 'ribbon-outline',
}: {
  label: string;
  value: T;
  selected: boolean;
  onPress: (v: T) => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      style={[styles.optCard, selected && styles.optCardActive]}
      onPress={() => onPress(value)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={selected ? colors.white : colors.oliGreen} />
      <Text style={[styles.optLabel, selected && styles.optLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const router      = useRouter();
  const { profile, setProfile } = useAuthStore();
  const [loading,   setLoading] = useState(false);

  const [tratamento, setTratamento] = useState<Tratamento | null>(null);
  const [crm,        setCrm]        = useState('');
  const [whatsapp,   setWhatsapp]   = useState('');
  const [especialidade,   setEspecialidade]   = useState('');
  const [cidade,          setCidade]          = useState('');
  const [uf,              setUf]              = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento | null>(null);
  const [objetivoOli,     setObjetivoOli]     = useState<ObjetivoOli | null>(null);

  // Indicação (referral) capturada silenciosamente via deep link — sem UI,
  // sem perguntar nada ao profissional. Resolve em background se houver
  // código pendente de um link de compartilhamento (?ref=).
  const [referidoPorId, setReferidoPorId] = useState<string | null>(null);
  const [comoConheceu,  setComoConheceu]  = useState<string | null>(null);
  const [referrerNome,  setReferrerNome]  = useState<string | null>(null);

  // Fallback manual do código de indicação — cobre instalação nova sem
  // deferred deep link (usuário baixou o app depois de ver o link/código).
  const [showManualRef, setShowManualRef] = useState(false);
  const [manualCode,    setManualCode]    = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError,   setManualError]   = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const pending = await getPendingReferralCode();
      if (!pending || !alive) return;
      const { data } = await supabase.rpc('resolve_referral_code', { p_code: pending.trim().toUpperCase() });
      const match = (data as { id: string; nome: string }[] | null)?.[0];
      if (match && match.id !== profile?.id && alive) {
        setReferidoPorId(match.id);
        setComoConheceu('membro_oli');
        setReferrerNome(match.nome);
      }
      await clearPendingReferralCode();
    })();
    return () => { alive = false; };
  }, [profile?.id]);

  const handleApplyCode = async () => {
    const c = manualCode.trim();
    if (!c) return;
    setManualLoading(true);
    setManualError(null);
    const { data } = await supabase.rpc('resolve_referral_code', { p_code: c.toUpperCase() });
    const match = (data as { id: string; nome: string }[] | null)?.[0];
    setManualLoading(false);
    if (!match || match.id === profile?.id) {
      setManualError('Código não encontrado.');
      return;
    }
    setReferidoPorId(match.id);
    setComoConheceu('membro_oli');
    setReferrerNome(match.nome);
  };

  const handleRemoveCode = () => {
    setReferidoPorId(null);
    setReferrerNome(null);
    setComoConheceu(null);
    setManualCode('');
    setManualError(null);
    setShowManualRef(false);
  };

  const whatsappDigits = whatsapp.replace(/\D/g, '');
  const isValid = whatsappDigits.length >= 10
    && especialidade.trim().length > 0
    && cidade.trim().length > 0
    && uf.trim().length === 2
    && tipoAtendimento !== null
    && objetivoOli !== null;

  const handleFinish = async () => {
    if (!profile?.id) {
      Alert.alert('Erro', 'Sessão expirada. Faça login novamente.');
      router.replace('/login');
      return;
    }
    if (!isValid) {
      Alert.alert('Faltam informações', 'Preencha WhatsApp, especialidade, cidade/UF, tipo de atendimento e o que te traz ao OLI.');
      return;
    }
    setLoading(true);
    try {
      // Se o nome já vem com "Dr"/"Dra", não duplica o tratamento (evita "Dr. Dr. João").
      const nomeJaTemTratamento = /^\s*dra?\.?\s/i.test(profile.nome ?? '');
      const tratamentoFinal = nomeJaTemTratamento ? null : tratamento;

      const especialidadeTrim = especialidade.trim() || null;

      const { data, error } = await supabase
        .from('profiles')
        .update({
          onboarding_complete: true,
          tratamento:          tratamentoFinal,
          crm:                 crm.trim() || null,
          whatsapp:            whatsapp.trim(),
          como_conheceu:       comoConheceu,
          referido_por:        referidoPorId,
          especialidade:       especialidadeTrim,
          atividade_exercida:  especialidadeTrim,
          cidade_uf:           cidade.trim() && uf.trim() ? `${cidade.trim()} / ${uf.trim().toUpperCase()}` : null,
          tipo_atendimento:    tipoAtendimento,
          objetivo_oli:        objetivoOli,
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;
      if (data) setProfile(data);

      void creditOlicoins(profile.id, 'cadastro_completo', 10);

      if (referidoPorId) {
        void supabase
          .rpc('apply_referral_benefit', { p_referrer_id: referidoPorId, p_new_user_id: profile.id })
          .then(() => {}, () => {});
      }

      router.replace('/');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar suas informações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.flex}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
        >
          <Text style={styles.title}>Só mais um passo</Text>
          <Text style={styles.subtitle}>
            Informações básicas pra gente te identificar. O resto do seu perfil você completa
            dentro do app, no seu ritmo — e ganha Olicoins por isso.
          </Text>

          {/* Tratamento — opcional */}
          <Text style={styles.question}>Tratamento <Text style={styles.optionalHint}>(opcional)</Text></Text>
          <View style={styles.boolRow}>
            <OptionCard value={'Dr.' as Tratamento}  label="Dr."  selected={tratamento === 'Dr.'}  onPress={setTratamento} icon="man-outline" />
            <OptionCard value={'Dra.' as Tratamento} label="Dra." selected={tratamento === 'Dra.'} onPress={setTratamento} icon="woman-outline" />
          </View>

          {/* WhatsApp — obrigatório */}
          <Text style={[styles.question, styles.questionSpacing]}>WhatsApp</Text>
          <Text style={styles.questionHint}>Com DDD — é como a recepção e o suporte falam com você</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ex: (11) 91234-5678"
            placeholderTextColor={colors.gray}
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
            accessibilityLabel="WhatsApp"
          />

          {/* CRM/Conselho — opcional */}
          <Text style={[styles.question, styles.questionSpacing]}>
            Conselho de classe <Text style={styles.optionalHint}>(opcional)</Text>
          </Text>
          <Text style={styles.questionHint}>CRM, CRP, CRN, CRO… — ex: CRM-SP 123456</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ex: CRM-SP 000000"
            placeholderTextColor={colors.gray}
            value={crm}
            onChangeText={setCrm}
            autoCapitalize="characters"
            accessibilityLabel="Conselho de classe"
          />

          {/* Especialidade — obrigatório */}
          <Text style={[styles.question, styles.questionSpacing]}>Especialidade</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ex: Cardiologia"
            placeholderTextColor={colors.gray}
            value={especialidade}
            onChangeText={setEspecialidade}
            accessibilityLabel="Especialidade"
          />

          {/* Cidade/UF — obrigatório */}
          <Text style={[styles.question, styles.questionSpacing]}>Cidade / UF</Text>
          <View style={styles.cityRow}>
            <TextInput
              style={[styles.textInput, styles.cityInput]}
              placeholder="Ex: São Paulo"
              placeholderTextColor={colors.gray}
              value={cidade}
              onChangeText={setCidade}
              accessibilityLabel="Cidade"
            />
            <TextInput
              style={[styles.textInput, styles.ufInput]}
              placeholder="UF"
              placeholderTextColor={colors.gray}
              value={uf}
              onChangeText={t => setUf(t.toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
              maxLength={2}
              accessibilityLabel="UF"
            />
          </View>

          {/* Tipo de atendimento — obrigatório */}
          <Text style={[styles.question, styles.questionSpacing]}>Tipo de atendimento</Text>
          <View style={styles.boolRow}>
            <OptionCard<TipoAtendimento> value="presencial"   label="Presencial"    selected={tipoAtendimento === 'presencial'}   onPress={setTipoAtendimento} icon="business-outline" />
            <OptionCard<TipoAtendimento> value="telemedicina" label="Telemedicina"  selected={tipoAtendimento === 'telemedicina'} onPress={setTipoAtendimento} icon="videocam-outline" />
            <OptionCard<TipoAtendimento> value="ambos"        label="Ambos"         selected={tipoAtendimento === 'ambos'}        onPress={setTipoAtendimento} icon="infinite-outline" />
          </View>

          {/* Objetivo com o OLI — obrigatório */}
          <Text style={[styles.question, styles.questionSpacing]}>O que te traz ao OLI?</Text>
          <View style={styles.objetivoCol}>
            <OptionCard<ObjetivoOli> value="migrar_rotina" label="Quero migrar minha rotina pro OLI" selected={objetivoOli === 'migrar_rotina'} onPress={setObjetivoOli} icon="briefcase-outline" />
            <OptionCard<ObjetivoOli> value="espaco_avulso" label="Quero um espaço avulso, uso pontual" selected={objetivoOli === 'espaco_avulso'} onPress={setObjetivoOli} icon="time-outline" />
            <OptionCard<ObjetivoOli> value="so_conhecer"   label="Só quero conhecer por enquanto"     selected={objetivoOli === 'so_conhecer'}   onPress={setObjetivoOli} icon="eye-outline" />
          </View>

          {/* Indicação — resolvida em silêncio via deep link; fallback manual aqui */}
          {referidoPorId ? (
            <View style={[styles.refAppliedRow, styles.questionSpacing]}>
              <Ionicons name="gift-outline" size={16} color={colors.oliGreen} />
              <Text style={styles.refAppliedText}>Indicado por {referrerNome ?? 'um membro OLI'}</Text>
              <TouchableOpacity onPress={handleRemoveCode} accessibilityLabel="Remover indicação">
                <Text style={styles.refRemoveText}>Remover</Text>
              </TouchableOpacity>
            </View>
          ) : showManualRef ? (
            <View style={[styles.refWrap, styles.questionSpacing]}>
              <View style={styles.refInputRow}>
                <TextInput
                  style={styles.refInput}
                  placeholder="Ex: MAR-8124A"
                  placeholderTextColor={colors.gray}
                  value={manualCode}
                  onChangeText={setManualCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  accessibilityLabel="Código de indicação"
                />
                <TouchableOpacity
                  style={[styles.refApplyBtn, (!manualCode.trim() || manualLoading) && styles.refApplyBtnDisabled]}
                  onPress={handleApplyCode}
                  disabled={manualLoading || !manualCode.trim()}
                  accessibilityLabel="Aplicar código de indicação"
                >
                  {manualLoading
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.refApplyText}>Aplicar</Text>}
                </TouchableOpacity>
              </View>
              {manualError && <Text style={styles.refErrorText}>{manualError}</Text>}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.questionSpacing}
              onPress={() => setShowManualRef(true)}
              accessibilityLabel="Tenho um código de indicação"
            >
              <Text style={styles.refToggleText}>Tem um código de indicação?</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.finishBtn, (!isValid || loading) && styles.finishBtnDisabled]}
            onPress={handleFinish}
            disabled={!isValid || loading}
            accessibilityLabel="Entrar no app"
          >
            <Text style={styles.finishBtnText}>{loading ? 'Salvando...' : 'Entrar no app'}</Text>
            {!loading && <Ionicons name="checkmark" size={18} color={colors.white} />}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  flex:    { flex: 1, justifyContent: 'space-between' },
  scroll:  { flex: 1 },
  content: { padding: spacing.lg },
  title:    { fontSize: 26, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.oliLightGray, marginBottom: spacing.lg, lineHeight: 20 },

  question:      { fontSize: 15, fontWeight: '600', color: colors.oliDarkGray },
  questionSpacing: { marginTop: spacing.lg },
  questionHint:  { fontSize: 12, color: colors.oliLightGray, marginTop: 2, marginBottom: spacing.sm },
  optionalHint:  { fontSize: 12, fontWeight: '400', color: colors.oliLightGray },

  boolRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  optCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingVertical: 14, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  optCardActive: { backgroundColor: colors.oliGreen, borderColor: colors.oliGreen },
  optLabel:       { fontSize: 15, fontWeight: '600', color: colors.oliDarkGray },
  optLabelActive: { color: colors.white },

  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15,
    color: colors.oliDarkGray, backgroundColor: colors.white,
  },

  cityRow:   { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cityInput: { flex: 3 },
  ufInput:   { flex: 1, textAlign: 'center' },
  objetivoCol: { gap: spacing.sm, marginTop: spacing.sm },

  refToggleText: { fontSize: 13, color: colors.oliGreen, fontWeight: '600', textDecorationLine: 'underline' },
  refWrap: { gap: spacing.xs },
  refInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  refInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.oliDarkGray,
  },
  refApplyBtn: {
    backgroundColor: colors.oliGreen, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    minWidth: 80, alignItems: 'center', justifyContent: 'center',
  },
  refApplyBtnDisabled: { opacity: 0.5 },
  refApplyText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  refErrorText: { color: colors.oliRed, fontSize: 12 },
  refAppliedRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: `${colors.oliGreen}14`, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  refAppliedText: { flex: 1, color: colors.oliGreen, fontWeight: '600', fontSize: 13 },
  refRemoveText: { color: colors.oliLightGray, fontSize: 12, textDecorationLine: 'underline' },

  footer: { padding: spacing.lg },
  finishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.oliGreen, borderRadius: radius.md, paddingVertical: 16,
  },
  finishBtnDisabled: { opacity: 0.5 },
  finishBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});
