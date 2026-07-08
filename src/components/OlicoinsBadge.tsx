import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/designSystem';
import { fetchTotalOlicoins } from '../services/olicoinsService';

export function OlicoinsBadge({ professionalId }: { professionalId: string }) {
  const [olicoins, setOlicoins] = useState<number | null>(null);
  const [displayed, setDisplayed] = useState(0);
  const countAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const firstLoad = useRef(true);

  useEffect(() => {
    let alive = true;
    fetchTotalOlicoins(professionalId).then(v => { if (alive) setOlicoins(v); });
    return () => { alive = false; };
  }, [professionalId]);

  useEffect(() => {
    if (olicoins === null) return;

    if (firstLoad.current) {
      firstLoad.current = false;
      countAnim.setValue(olicoins);
      setDisplayed(olicoins);
      return;
    }

    const listenerId = countAnim.addListener(({ value }) => setDisplayed(Math.round(value)));
    Animated.timing(countAnim, { toValue: olicoins, duration: 700, useNativeDriver: false }).start();
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.25, useNativeDriver: true, friction: 3 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();

    return () => countAnim.removeListener(listenerId);
  }, [olicoins, countAnim, scaleAnim]);

  if (olicoins === null) return null;

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale: scaleAnim }] }]} accessibilityLabel={`${displayed} Olicoins`}>
      <FontAwesome5 name="coins" size={11} color={colors.oliGold} />
      <Text style={styles.text}>{displayed} Olicoins</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    backgroundColor:  `${colors.oliGold}1A`,
    borderRadius:     radius.full,
    paddingHorizontal: 10,
    paddingVertical:  3,
    marginTop:        spacing.xs,
  },
  text: { fontSize: 12, fontWeight: '700', color: colors.oliGold },
});
