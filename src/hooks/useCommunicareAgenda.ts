/**
 * useCommunicareAgenda — fila de pacientes do dia (CC), em tempo real.
 *
 * Regras:
 *  - SEMPRE só o dia corrente. A cada fetch a data "hoje" é recalculada.
 *  - "Morre todo dia": na virada de meia-noite os buckets são esvaziados
 *    (o dia anterior já foi para o histórico no Communicare). Nunca arrasta
 *    pacientes do dia anterior para o card.
 *  - Tempo real: polling curto + refetch ao voltar do background.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  listDaySchedule, bucketize, type AgendaBuckets, type CCAppointment,
} from '../services/communicareAgenda';
import { ccIsConfigured } from '../services/communicareApi';

const POLL_MS = 20_000;   // fila clínica — atualização quase em tempo real

const EMPTY: AgendaBuckets = {
  proximos: [], emEspera: [], emAtendimento: [], atendidos: [],
};

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD (local)

export function useCommunicareAgenda(professionalId?: string, clinicId?: string) {
  const [buckets, setBuckets] = useState<AgendaBuckets>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [enabled] = useState(ccIsConfigured());
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDateRef = useRef<string>(today());

  const fetchNow = useCallback(async () => {
    if (!enabled || !professionalId) return;

    // Rollover de dia: virou meia-noite → zera o card antes de buscar o novo dia.
    const d = today();
    if (d !== lastDateRef.current) {
      lastDateRef.current = d;
      setBuckets(EMPTY);
    }

    setLoading(true);
    try {
      // listDaySchedule usa o dia corrente por padrão — só pacientes de hoje.
      const appts: CCAppointment[] = await listDaySchedule({ professionalId, clinicId, date: d });
      setBuckets(bucketize(appts));
    } finally {
      setLoading(false);
    }
  }, [enabled, professionalId, clinicId]);

  useEffect(() => {
    if (!enabled || !professionalId) return;
    void fetchNow();
    timerRef.current = setInterval(() => { void fetchNow(); }, POLL_MS);

    // Re-fetch ao voltar do background (cobre também o rollover de dia)
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void fetchNow();
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [enabled, professionalId, fetchNow]);

  return { buckets, loading, enabled, refresh: fetchNow };
}
