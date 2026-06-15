/**
 * ReferralPromoModal — popup amigável que destaca o programa de indicação.
 * Aparece no primeiro acesso ao dashboard (uma vez), incentivando o médico
 * a indicar colegas e ganhar crédito de horas. Persistência via AsyncStorage.
 */

import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../theme/designSystem';

interface Props {
  visible:    boolean;
  onIndicar:  () => void;
  onClose:    () => void;
}

export function ReferralPromoModal({ visible, onIndicar, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, shadows.card]}>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Fechar"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={colors.oliLightGray} />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Ionicons name="gift" size={34} color={colors.white} />
          </View>

          <Text style={styles.title}>Indique e ganhe horas grátis</Text>
          <Text style={styles.body}>
            A cada colega que entrar no OLI pela sua indicação, você ganha{' '}
            <Text style={styles.bodyStrong}>1 hora de crédito</Text> para usar nas salas.
            Sem limite — quanto mais indicar, mais acumula.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onIndicar}
            accessibilityLabel="Ver meu código de indicação"
          >
            <Ionicons name="share-social-outline" size={18} color={colors.white} />
            <Text style={styles.primaryText}>Receber meu código</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onClose}
            accessibilityLabel="Agora não"
          >
            <Text style={styles.secondaryText}>Agora não</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(47,47,47,0.55)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         spacing.lg,
  },
  card: {
    width:           '100%',
    maxWidth:        360,
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    alignItems:      'center',
  },
  closeBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm, padding: 4, zIndex: 2 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.oliGold,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20, fontWeight: '800', color: colors.oliDarkGray,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  body: {
    fontSize: 14, color: colors.oliLightGray, lineHeight: 22,
    textAlign: 'center', marginBottom: spacing.lg,
  },
  bodyStrong: { color: colors.oliDarkGray, fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    width: '100%', backgroundColor: colors.oliGreen,
    borderRadius: radius.md, paddingVertical: spacing.md,
  },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  secondaryText: { color: colors.oliLightGray, fontSize: 14, fontWeight: '600' },
});
