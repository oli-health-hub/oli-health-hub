import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius } from '../theme/designSystem';

export function IndiqueEGanheButton() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => router.push('/indicacao')}
      accessibilityLabel="Programa de Indicação — indique um colega e ganhe 1 hora grátis"
    >
      <Ionicons name="gift-outline" size={12} color={colors.oliGreen} />
      <Text style={styles.text}>Indique e Ganhe</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   `${colors.oliGreen}1A`,
    borderRadius:      radius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
    marginTop:         4,
  },
  text: { fontSize: 12, fontWeight: '700', color: colors.oliGreen },
});
