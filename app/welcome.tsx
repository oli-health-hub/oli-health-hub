import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, shadows } from '../src/theme/designSystem';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.logoArea}>
        <Image
          source={require('../assets/logo-circle.png')}
          style={styles.logoImage}
          accessibilityLabel="Logo OLI Health Hub"
        />
        <Text style={styles.title}>OLI Health Hub</Text>
        <Text style={styles.subtitle}>Plataforma do profissional de saúde</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, shadows.card]}
          onPress={() => router.push('/login?mode=cadastro' as never)}
          accessibilityLabel="Criar conta"
        >
          <Text style={styles.btnPrimaryText}>Criar conta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => router.push('/login?mode=login' as never)}
          accessibilityLabel="Já tenho conta"
        >
          <Text style={styles.btnSecondaryText}>Já tenho conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.oliBackground,
    justifyContent:  'space-between',
    padding:         spacing.lg,
    paddingBottom:   spacing.xl * 2,
  },
  logoArea: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  logoImage: {
    width:         110,
    height:        110,
    resizeMode:    'contain',
    marginBottom:  spacing.lg,
  },
  title: {
    fontSize:   28,
    fontWeight: '700',
    color:      colors.oliDarkGray,
  },
  subtitle: {
    fontSize:   14,
    color:      colors.oliLightGray,
    marginTop:  6,
    textAlign:  'center',
  },
  actions: {
    gap: spacing.md,
  },
  btn: {
    borderRadius: radius.md,
    padding:      spacing.md,
    alignItems:   'center',
    minHeight:    52,
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.oliGreen,
  },
  btnPrimaryText: {
    color:      colors.white,
    fontSize:   16,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: colors.white,
    borderWidth:     1.5,
    borderColor:     colors.oliGreen,
  },
  btnSecondaryText: {
    color:      colors.oliGreen,
    fontSize:   16,
    fontWeight: '700',
  },
});
