import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../theme/designSystem';
import { fetchTotalOlicoins, ACTION_OBJECTIVES } from '../services/olicoinsService';
import { supabase } from '../services/supabase';
import { PROFILE_SECTIONS } from '../utils/profileSections';
import type { Profile } from '../services/auth';

const TOTAL_OBJETIVOS = PROFILE_SECTIONS.length + ACTION_OBJECTIVES.length;
const SHIMMER_WIDTH = 70;

export function ProfileCompletionCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [olicoins, setOlicoins] = useState(0);
  const [actionEventos, setActionEventos] = useState<Set<string>>(new Set());

  const profileDone = PROFILE_SECTIONS.filter(s => s.isComplete(profile)).length;
  const actionDone = ACTION_OBJECTIVES.filter(o => actionEventos.has(o.evento)).length;
  const completed = profileDone + actionDone;
  const ratio = completed / TOTAL_OBJETIVOS;
  const allDone = completed === TOTAL_OBJETIVOS;

  const fillAnim    = useRef(new Animated.Value(ratio)).current;
  const breatheAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const prevCompleted = useRef(completed);

  useEffect(() => {
    fetchTotalOlicoins(profile.id).then(setOlicoins);
    supabase.from('olicoins_ledger').select('evento').eq('professional_id', profile.id).then(({ data }) => {
      setActionEventos(new Set((data ?? []).map(r => r.evento)));
    });
  }, [profile.id]);

  // Barra "viva": respiração de brilho contínua + brilho varrendo, como energia/líquido subindo.
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }),
    );
    breathe.start();
    shimmer.start();
    return () => { breathe.stop(); shimmer.stop(); };
  }, [breatheAnim, shimmerAnim]);

  useEffect(() => {
    Animated.spring(fillAnim, { toValue: ratio, useNativeDriver: false, friction: 7, tension: 40 }).start();
    prevCompleted.current = completed;
  }, [completed, ratio, fillAnim]);

  const fillWidth   = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const shimmerX    = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-SHIMMER_WIDTH, 260] });

  return (
    <TouchableOpacity
      style={[styles.card, shadows.small]}
      onPress={() => router.push('/completar-perfil')}
      accessibilityLabel="Ver objetivos e Olicoins"
    >
      <View style={[styles.iconWrap, allDone && styles.iconWrapDone]}>
        <Ionicons name={allDone ? 'trophy' : 'trophy-outline'} size={22} color={allDone ? colors.white : colors.oliGold} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{allDone ? 'Objetivos completos!' : 'Seus objetivos'}</Text>
        <Text style={styles.subtitle}>{completed} de {TOTAL_OBJETIVOS}</Text>
        <View style={styles.track}>
          <Animated.View style={[
            styles.fill,
            allDone && styles.fillDone,
            { width: fillWidth, opacity: breatheOpacity },
          ]}>
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerX }, { skewX: '-20deg' }] }]} />
          </Animated.View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.oliLightGray} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.oliGold}1A`,
    justifyContent: 'center', alignItems: 'center',
  },
  iconWrapDone: { backgroundColor: colors.oliGold },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600', color: colors.oliLightGray },
  subtitle: { fontSize: 11, color: colors.oliLightGray, marginBottom: 6 },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6, backgroundColor: colors.oliGreen, overflow: 'hidden' },
  fillDone: { backgroundColor: colors.oliGold },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0, width: SHIMMER_WIDTH,
    backgroundColor: `${colors.white}55`,
  },
});
