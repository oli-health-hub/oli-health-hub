import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../theme/designSystem';

const CALENDLY_URL = 'https://calendly.com/olihealthhub/atendimento-presencial';

interface Props {
  visible:  boolean;
  onOpen:   () => void;
  onDismiss: () => void;
}

export function CalendlyVisitBadge({ visible, onOpen, onDismiss }: Props) {
  if (!visible) return null;

  const handlePress = () => {
    Linking.openURL(CALENDLY_URL);
    onOpen();
  };

  return (
    <View style={[styles.wrap, shadows.card]}>
      <TouchableOpacity
        style={styles.dismiss}
        onPress={onDismiss}
        accessibilityLabel="Fechar aviso de agendamento de visita"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={14} color={colors.white} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.badge}
        onPress={handlePress}
        accessibilityLabel="Agendar visita presencial no Calendly"
      >
        <Ionicons name="calendar-outline" size={20} color={colors.white} />
        <Text style={styles.text}>Agendar visita</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right:    spacing.md,
    bottom:   spacing.lg,
  },
  badge: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing.xs,
    backgroundColor:  colors.oliGreen,
    paddingVertical:  10,
    paddingHorizontal: spacing.md,
    borderRadius:     radius.full,
  },
  text: {
    color:      colors.white,
    fontSize:   14,
    fontWeight: '700',
  },
  dismiss: {
    position:        'absolute',
    top:             -6,
    right:           -6,
    zIndex:          1,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: colors.oliDarkGray,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     colors.oliBackground,
  },
});
