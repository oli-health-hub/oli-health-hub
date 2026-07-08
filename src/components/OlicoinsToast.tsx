import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../theme/designSystem';

// Aparece por ~1.8s toda vez que `amount` muda (o pai controla a duração via `visible`).
export function OlicoinsToast({ visible, amount }: { visible: boolean; amount: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, amount, anim]);

  if (!visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={[styles.toast, shadows.card, { opacity: anim, transform: [{ translateY }] }]}>
      <FontAwesome5 name="coins" size={16} color={colors.oliGold} />
      <Text style={styles.text}>+{amount} Olicoins!</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: spacing.xl, left: spacing.lg, right: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.oliDarkGray, borderRadius: radius.full,
    paddingVertical: 12, paddingHorizontal: spacing.lg,
  },
  text: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
