/**
 * ScrollMoreIndicator
 * Indicador flutuante animado — aparece quando há conteúdo abaixo da dobra.
 * Não recebe clique (pointerEvents: 'none').
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/designSystem';

interface Props {
  /** Exibe o indicador quando true; anima para sumir quando false */
  visible: boolean;
}

export function ScrollMoreIndicator({ visible }: Props) {
  const opacity      = useRef(new Animated.Value(1)).current;
  const translateY   = useRef(new Animated.Value(0)).current;
  const bounceLoop   = useRef<Animated.CompositeAnimation | null>(null);

  // Fade in/out ao mudar visibilidade
  useEffect(() => {
    Animated.timing(opacity, {
      toValue:         visible ? 1 : 0,
      duration:        220,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  // Loop de bounce enquanto visível
  useEffect(() => {
    if (visible) {
      bounceLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, { toValue: 5,  duration: 480, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0,  duration: 480, useNativeDriver: true }),
        ]),
      );
      bounceLoop.current.start();
    } else {
      bounceLoop.current?.stop();
      translateY.setValue(0);
    }
    return () => { bounceLoop.current?.stop(); };
  }, [visible, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.pill}>
        <Ionicons name="chevron-down" size={14} color={colors.oliGreen} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:  'absolute',
    bottom:    14,
    left:      0,
    right:     0,
    alignItems: 'center',
    zIndex:    20,
  },
  pill: {
    backgroundColor: colors.white,
    borderRadius:    20,
    width:           32,
    height:          32,
    justifyContent:  'center',
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.12,
    shadowRadius:    6,
    elevation:       4,
  },
});
