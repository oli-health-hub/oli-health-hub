/**
 * Tela: Escolher Plano
 * Gate obrigatório para quem se cadastrou sem plano (cadastro deixou de dar
 * START automático — §29 do handoff, 13/ago). Única tela acessível até
 * escolher START ou PRO — sem chrome de navegação, sem botão voltar.
 */

import { useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/authStore';
import { supabase } from '../src/services/supabase';
import { colors, radius, shadows, spacing } from '../src/theme/designSystem';
import PlanCheckoutModal from '../src/components/PlanCheckoutModal';
import { FEATURES } from './meu-plano';
import type { PlanType } from '../src/models/types';

const PRO_PLAN_ID = '19fcea22-4f61-4a5f-a80e-f120144ac54e';

const PRO_PRICES: Record<'MONTHLY' | 'SEMESTRAL', number> = {
  MONTHLY:   599,
  SEMESTRAL: 499,
};

function benefits(plan: PlanType): string[] {
  return FEATURES.filter(f => f.plans[plan] === 'yes').map(f => f.label);
}

export default function EscolherPlanoScreen() {
  const { user, profile, setProfile } = useAuthStore();

  const [activatingStart, setActivatingStart] = useState(false);
  const [wantsCommitment, setWantsCommitment] = useState(false);
  const [proCiclo, setProCiclo] = useState<'MONTHLY' | 'SEMESTRAL'>('MONTHLY');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const refreshProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) setProfile(data);
  };

  const handleActivateStart = async () => {
    if (!user?.id) return;
    setActivatingStart(true);
    try {
      // subscriptions não tem INSERT liberado pro client (RLS só permite
      // SELECT própria + admin) — ativação passa por RPC controlado.
      const { error } = await supabase.rpc('activate_start_plan', {
        p_wants_commitment: wantsCommitment,
      });
      if (error) throw error;

      await refreshProfile();

      if (wantsCommitment) {
        Alert.alert(
          'START ativado!',
          'Nossa equipe vai entrar em contato para agendar seus diagnósticos contábil e jurídico gratuitos.',
        );
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível ativar o plano. Tente novamente.');
    } finally {
      setActivatingStart(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <Text style={s.title}>Escolha seu plano</Text>
        <Text style={s.subtitle}>
          Seu acesso ao OLI Health Hub começa por aqui — reservas, comunidade e
          pacientes ficam disponíveis assim que você escolher.
        </Text>

        {/* ── START ── */}
        <View style={[s.card, shadows.card]}>
          <View style={s.cardHeader}>
            <Text style={[s.planName, { color: colors.oliDarkGray }]}>START</Text>
            <Text style={s.planPrice}>Grátis</Text>
          </View>
          <Text style={s.planRate}>R$ 1,90/min de sessão</Text>

          {benefits('START').map(label => (
            <View key={label} style={s.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.oliGreen} />
              <Text style={s.benefitText}>{label}</Text>
            </View>
          ))}

          <View style={s.commitmentRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.commitmentTitle}>Compromisso de 6 meses</Text>
              <Text style={s.commitmentDesc}>
                Ganhe diagnóstico contábil + jurídico gratuitos, agendados pela nossa equipe.
              </Text>
            </View>
            <Switch
              value={wantsCommitment}
              onValueChange={setWantsCommitment}
              trackColor={{ true: colors.oliGreen }}
              accessibilityLabel="Quero compromisso de 6 meses"
            />
          </View>

          <TouchableOpacity
            style={s.startBtn}
            onPress={handleActivateStart}
            disabled={activatingStart}
            accessibilityLabel="Ativar plano START"
          >
            {activatingStart
              ? <ActivityIndicator color={colors.white} size="small" />
              : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={s.startBtnText}>Ativar grátis</Text>
                </>
              )}
          </TouchableOpacity>
        </View>

        {/* ── PRO ── */}
        <View style={[s.card, shadows.card, { borderColor: colors.oliGold, borderWidth: 2 }]}>
          <View style={s.cardHeader}>
            <Text style={[s.planName, { color: colors.oliGold }]}>PRO</Text>
            <Text style={s.planPrice}>
              {`R$ ${PRO_PRICES[proCiclo].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              <Text style={s.planPricePeriod}>/mês</Text>
            </Text>
          </View>
          <Text style={s.planRate}>R$ 1,45/min de sessão</Text>

          <View style={s.cicloRow}>
            {(['MONTHLY', 'SEMESTRAL'] as const).map(c => (
              <TouchableOpacity
                key={c}
                style={[s.cicloBtn, proCiclo === c && { backgroundColor: colors.oliGold }]}
                onPress={() => setProCiclo(c)}
                accessibilityLabel={c === 'MONTHLY' ? 'Mensal' : 'Semestral'}
              >
                <Text style={[s.cicloBtnText, proCiclo === c && s.cicloBtnTextActive]}>
                  {c === 'MONTHLY' ? 'Mensal' : 'Semestral'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {proCiclo === 'SEMESTRAL' && (
            <Text style={s.cicloNote}>Fidelidade de 6 meses, cobrança mensal.</Text>
          )}

          {benefits('PRO').map(label => (
            <View key={label} style={s.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.oliGreen} />
              <Text style={s.benefitText}>{label}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={s.proBtn}
            onPress={() => setCheckoutOpen(true)}
            accessibilityLabel="Assinar plano PRO"
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color={colors.white} />
            <Text style={s.startBtnText}>Assinar PRO</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <PlanCheckoutModal
        visible={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={() => { setCheckoutOpen(false); refreshProfile(); }}
        planId={PRO_PLAN_ID}
        planName="PRO"
        ciclo={proCiclo}
        value={PRO_PRICES[proCiclo]}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },

  title:    { fontSize: 24, fontWeight: '800', color: colors.oliDarkGray, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 20, marginBottom: spacing.sm },

  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.lg,
    gap:             spacing.sm,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName:   { fontSize: 20, fontWeight: '800' },
  planPrice:  { fontSize: 18, fontWeight: '800', color: colors.oliDarkGray },
  planPricePeriod: { fontSize: 12, fontWeight: '500', color: colors.gray },
  planRate:   { fontSize: 13, color: colors.gray },

  benefitRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  benefitText: { fontSize: 13, color: colors.oliDarkGray, flex: 1 },

  cicloRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  cicloBtn: {
    flex: 1, paddingVertical: 8, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  cicloBtnText:       { fontSize: 12, fontWeight: '700', color: colors.oliDarkGray },
  cicloBtnTextActive: { color: colors.white },
  cicloNote: { fontSize: 12, color: colors.oliGold, fontStyle: 'italic' },

  commitmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  commitmentTitle: { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray },
  commitmentDesc:  { fontSize: 12, color: colors.gray, marginTop: 2 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.oliGreen, borderRadius: radius.md,
    paddingVertical: 14, marginTop: spacing.sm,
  },
  proBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.oliGold, borderRadius: radius.md,
    paddingVertical: 14, marginTop: spacing.sm,
  },
  startBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
