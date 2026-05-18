import { useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { useAppStore, getCurrentCost, getTimerPhase } from '../store/appStore';

export interface TimerState {
  elapsedSeconds:   number;
  remainingSeconds: number;
  currentCost:      number;
  isRunning:        boolean;
  phase:            'normal' | 'buffer' | 'overtime';
}

/**
 * Timer sem drift: o tempo decorrido é sempre calculado com Date.now()
 * subtraindo o sessionStartTime real — funciona corretamente quando o app
 * vai para background e volta.
 */
export function useTimer(): TimerState {
  const { sessionStartTime, sessionEndTime, userPlan, enterBuffer, enterOvertime } = useAppStore();
  const [, setTick] = useState(0); // Força re-render a cada segundo

  const prevPhaseRef = useRef<'normal' | 'buffer' | 'overtime'>('normal');

  // Inicia/para o intervalo conforme a sessão
  useEffect(() => {
    if (!sessionStartTime) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [sessionStartTime]);

  // Retoma corretamente após o app voltar do background
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') setTick(t => t + 1);
    });
    return () => sub.remove();
  }, []);

  // Valores calculados com Date.now() — nunca acumulam erro
  const elapsedSeconds   = sessionStartTime
    ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
    : 0;
  const currentCost      = getCurrentCost(userPlan, sessionStartTime);
  const { phase, remainingSeconds } = getTimerPhase(sessionEndTime);
  const isRunning        = !!sessionStartTime;

  // Dispara transições de fase (uma única vez por transição)
  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      if (phase === 'buffer')   enterBuffer();
      if (phase === 'overtime') enterOvertime();
      prevPhaseRef.current = phase;
    }
  });

  return { elapsedSeconds, remainingSeconds, currentCost, isRunning, phase };
}
