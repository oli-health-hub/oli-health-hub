/**
 * Tela: Conta Bloqueada
 * Exibida quando profile.account_status != 'active' (paused/suspended/banned/deleted).
 * Médico só pode contatar a recepção ou fazer logout.
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/authStore';
import { colors, spacing, radius } from '../src/theme/designSystem';
import { contactReception } from '../src/utils/whatsapp';
import { signOut } from '../src/services/auth';

const STATUS_META: Record<string, { title: string; description: string; color: string; bg: string; icon: 'pause-circle' | 'lock-closed' | 'ban' | 'trash' }> = {
  paused: {
    title:       'Conta pausada',
    description: 'Sua conta está temporariamente pausada. Entre em contato com a recepção para reativar.',
    color:       '#B8893C',
    bg:          '#FEF3C7',
    icon:        'pause-circle',
  },
  suspended: {
    title:       'Conta suspensa',
    description: 'Sua conta foi suspensa. Pode haver pendência financeira ou operacional. Entre em contato.',
    color:       '#EA580C',
    bg:          '#FED7AA',
    icon:        'lock-closed',
  },
  banned: {
    title:       'Conta bloqueada',
    description: 'O acesso foi revogado por violação de regras. Entre em contato se houver dúvidas.',
    color:       '#DC2626',
    bg:          '#FEE2E2',
    icon:        'ban',
  },
  deleted: {
    title:       'Conta excluída',
    description: 'Esta conta foi excluída. Histórico preservado para fins de auditoria. Entre em contato se foi engano.',
    color:       '#6B7280',
    bg:          '#F3F4F6',
    icon:        'trash',
  },
};

export default function ContaBloqueadaScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const status = ((profile as { account_status?: string } | null)?.account_status ?? 'suspended') as keyof typeof STATUS_META;
  const reason = (profile as { status_reason?: string } | null)?.status_reason ?? null;
  const meta = STATUS_META[status] ?? STATUS_META.suspended;

  const handleLogout = async () => {
    await signOut().catch(() => {});
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.content}>

        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={48} color={meta.color} />
        </View>

        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.description}>{meta.description}</Text>

        {reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>MOTIVO</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={() => contactReception('Olá, preciso de ajuda com minha conta no OLI Health Hub.')}>
          <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
          <Text style={styles.primaryBtnText}>Falar com a recepção</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={colors.oliDarkGray} />
          <Text style={styles.secondaryBtnText}>Sair</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          OLI Health Hub · Suporte 24/7 via WhatsApp
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },

  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  title: {
    fontSize: 24, fontWeight: '800', color: colors.oliDarkGray,
    textAlign: 'center',
  },
  description: {
    fontSize: 15, color: colors.gray,
    textAlign: 'center', lineHeight: 22,
    maxWidth: 360,
  },

  reasonBox: {
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: '#E5DDD2',
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%', maxWidth: 360,
    marginTop: spacing.sm,
  },
  reasonLabel: { fontSize: 11, fontWeight: '800', color: colors.oliLightGray, letterSpacing: 1, marginBottom: 4 },
  reasonText:  { fontSize: 14, color: colors.oliDarkGray, fontStyle: 'italic' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.md,
    width: '100%', maxWidth: 360,
    marginTop: spacing.md,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  secondaryBtnText: { color: colors.oliDarkGray, fontSize: 14, fontWeight: '600' },

  footer: {
    fontSize: 11, color: colors.oliLightGray, marginTop: spacing.md,
    textAlign: 'center',
  },
});
