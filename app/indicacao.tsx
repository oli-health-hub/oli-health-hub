/**
 * Tela: Programa de Indicação OLI
 *
 * Gera e exibe o código único de indicação do profissional.
 * Cada indicado confirmado = 1 hora de crédito (60 min) para o indicador.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Share,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/store/authStore';
import { colors, radius, shadows, spacing } from '../src/theme/designSystem';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface Referral {
  id:          string;
  nome:        string;
  especialidade: string | null;
  created_at:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function IndicacaoScreen() {
  const user    = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const [code,      setCode]      = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied,    setCopied]    = useState(false);

  // ── Carrega ou gera código ────────────────────────────────────────────────

  const loadCode = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Tenta buscar código existente primeiro
      const { data: prof } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      if ((prof as { referral_code: string | null } | null)?.referral_code) {
        setCode((prof as { referral_code: string }).referral_code);
      } else {
        // Gera via RPC
        const { data: generated } = await supabase
          .rpc('generate_referral_code', { p_user_id: user.id });
        setCode(generated as string ?? null);
      }

      // Carrega lista de indicados
      const { data: refs } = await supabase
        .from('profiles')
        .select('id, nome, especialidade, created_at')
        .eq('referido_por', user.id)
        .order('created_at', { ascending: false });

      setReferrals((refs ?? []) as Referral[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadCode(); }, [loadCode]);

  // ── Compartilhar ──────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!code) return;
    const nome = profile?.nome ?? 'um colega';
    await Share.share({
      message:
        `Estou usando o OLI Health Hub — coworking médico premium em São Paulo.\n\n` +
        `Me cadastrei e está sendo incrível! Ao se cadastrar, mencione meu nome "${nome}" ` +
        `(ou use o código ${code}) na etapa de indicação e ganhamos créditos juntos.\n\n` +
        `Acesse: https://olihealthhub.com`,
      title: 'OLI Health Hub — Indicação',
    });
  };

  // ── Copiar código ─────────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Programa de Indicação', headerBackTitle: 'Voltar' }} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.oliGreen} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Programa de Indicação', headerBackTitle: 'Voltar' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[styles.heroCard, shadows.card]}>
          <Ionicons name="gift" size={40} color={colors.oliGold} style={{ marginBottom: spacing.sm }} />
          <Text style={styles.heroTitle}>Indique e ganhe 1 hora grátis</Text>
          <Text style={styles.heroDesc}>
            Para cada colega que se cadastrar com o seu código e ativar a conta, você recebe{' '}
            <Text style={styles.heroBold}>60 minutos de crédito</Text> nas salas OLI.
          </Text>
        </View>

        {/* Código */}
        <Text style={styles.sectionLabel}>Seu código de indicação</Text>
        <View style={[styles.codeCard, shadows.card]}>
          <Text style={styles.codeText}>{code ?? '—'}</Text>
          <View style={styles.codeActions}>
            <TouchableOpacity
              style={styles.codeActionBtn}
              onPress={handleCopy}
              accessibilityLabel="Copiar código de indicação"
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.oliGreen} />
              <Text style={styles.codeActionText}>{copied ? 'Copiado!' : 'Copiar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.codeActionBtn, styles.shareBtn]}
              onPress={handleShare}
              accessibilityLabel="Compartilhar código de indicação"
            >
              <Ionicons name="share-social-outline" size={18} color={colors.white} />
              <Text style={[styles.codeActionText, { color: colors.white }]}>Compartilhar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Como funciona */}
        <Text style={styles.sectionLabel}>Como funciona</Text>
        <View style={[styles.stepsCard, shadows.card]}>
          {[
            { icon: 'share-outline',        text: 'Compartilhe seu código com colegas médicos' },
            { icon: 'person-add-outline',   text: 'Eles se cadastram e informam seu nome ou código' },
            { icon: 'checkmark-circle-outline', text: 'Ao ativar a conta, você ganha 1 hora de crédito' },
            { icon: 'infinite-outline',     text: 'Sem limite de indicações — acumule quantas quiser' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Ionicons name={step.icon as 'share-outline'} size={18} color={colors.oliGreen} style={{ flexShrink: 0 }} />
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Seus indicados */}
        <Text style={styles.sectionLabel}>
          Seus indicados ({referrals.length})
        </Text>

        {referrals.length === 0 ? (
          <View style={[styles.emptyCard, shadows.card]}>
            <Ionicons name="people-outline" size={32} color={colors.gray} />
            <Text style={styles.emptyText}>Nenhum indicado ainda</Text>
            <Text style={styles.emptySubtext}>
              Compartilhe seu código e acompanhe aqui quem se cadastrou.
            </Text>
          </View>
        ) : (
          <View style={[styles.referralList, shadows.card]}>
            {referrals.map((ref, i) => (
              <View
                key={ref.id}
                style={[styles.referralRow, i < referrals.length - 1 && styles.referralRowBorder]}
              >
                <View style={styles.referralAvatar}>
                  <Text style={styles.referralAvatarText}>
                    {ref.nome.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referralName}>{ref.nome}</Text>
                  {ref.especialidade ? (
                    <Text style={styles.referralSpec}>{ref.especialidade}</Text>
                  ) : null}
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.oliGreen} />
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  heroCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.lg,
    alignItems:      'center',
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: colors.oliDarkGray, textAlign: 'center', marginBottom: spacing.sm },
  heroDesc:  { fontSize: 14, color: colors.oliLightGray, textAlign: 'center', lineHeight: 22 },
  heroBold:  { fontWeight: '700', color: colors.oliGreen },

  sectionLabel: {
    fontSize:      13,
    fontWeight:    '700',
    color:         colors.oliDarkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  codeCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.lg,
    alignItems:      'center',
    gap:             spacing.md,
    borderWidth:     2,
    borderColor:     `${colors.oliGreen}40`,
  },
  codeText: {
    fontSize:      32,
    fontWeight:    '800',
    color:         colors.oliGreen,
    letterSpacing: 3,
  },
  codeActions: { flexDirection: 'row', gap: spacing.sm },
  codeActionBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    borderRadius:    radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth:     1.5,
    borderColor:     colors.oliGreen,
  },
  shareBtn:       { backgroundColor: colors.oliGreen, borderColor: colors.oliGreen },
  codeActionText: { fontSize: 14, fontWeight: '600', color: colors.oliGreen },

  stepsCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.md,
  },
  stepRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepNumber:     { width: 22, height: 22, borderRadius: 11, backgroundColor: `${colors.oliGreen}15`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumberText: { fontSize: 11, fontWeight: '700', color: colors.oliGreen },
  stepText:       { fontSize: 13, color: colors.oliDarkGray, flex: 1, lineHeight: 18 },

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.xl,
    alignItems:      'center',
    gap:             spacing.sm,
  },
  emptyText:    { fontSize: 15, fontWeight: '600', color: colors.oliDarkGray },
  emptySubtext: { fontSize: 13, color: colors.gray, textAlign: 'center', lineHeight: 20 },

  referralList: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  referralRow: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        spacing.md,
    gap:            spacing.sm,
  },
  referralRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  referralAvatar:    {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: `${colors.oliGreen}20`,
    alignItems:      'center',
    justifyContent:  'center',
  },
  referralAvatarText: { fontSize: 16, fontWeight: '700', color: colors.oliGreen },
  referralName:       { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  referralSpec:       { fontSize: 12, color: colors.gray, marginTop: 2 },
});
