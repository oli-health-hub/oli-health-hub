import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/designSystem';

interface Props {
  visible:  boolean;
  onUpdate: () => void;
  onLater:  () => void;
}

export function UpdateAvailableModal({ visible, onUpdate, onLater }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-download-outline" size={28} color={colors.white} />
          </View>
          <Text style={styles.title}>Nova versão disponível</Text>
          <Text style={styles.message}>
            Preparamos melhorias no OLI Health Hub. Atualize agora para usar a versão mais recente.
            O aplicativo será reiniciado rapidamente.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onUpdate}
            accessibilityRole="button"
            accessibilityLabel="Atualizar o aplicativo agora"
          >
            <Text style={styles.primaryText}>Atualizar agora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterBtn}
            onPress={onLater}
            accessibilityRole="button"
            accessibilityLabel="Atualizar depois"
          >
            <Text style={styles.laterText}>Depois</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(47,47,47,0.45)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         spacing.lg,
  },
  card: {
    width:           '100%',
    maxWidth:        360,
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    alignItems:      'center',
    gap:             spacing.md,
  },
  iconCircle: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: colors.oliGreen,
    justifyContent:  'center',
    alignItems:      'center',
  },
  title:   { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray, textAlign: 'center' },
  message: { fontSize: 14, color: colors.oliLightGray, textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    alignSelf:       'stretch',
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: colors.white },
  laterBtn:    { paddingVertical: spacing.sm },
  laterText:   { fontSize: 14, fontWeight: '600', color: colors.oliLightGray },
});
