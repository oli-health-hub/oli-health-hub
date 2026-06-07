/**
 * useCommunicareAgenda — puxa agenda de pacientes do CC com polling.
 * Enquanto CC não tiver webhook de status, polling a cada 60s mantém
 * Próximos / Em espera / Em atendimento / Atendidos atualizados.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  listDaySchedule, bucketize, type AgendaBuckets, type CCAppointment,
} from '../services/communicareAgenda';
import { ccIsConfigured } from '../services/communicareApi';

const POLL_MS = 60_000;

const EMPTY: AgendaBuckets = {
  proximos: [], emEspera: [], emAtendimento: [], atendidos: [],
};

export function useCommunicareAgenda(professionalId?: string, clinicId?: string) {
  const [buckets, setBuckets] = useState<AgendaBuckets>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [enabled] = useState(ccIsConfigured());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNow = useCallback(async () => {
    if (!enabled || !professionalId) return;
    setLoading(true);
    try {
      const appts: CCAppointment[] = await listDaySchedule({ professionalId, clinicId });
      setBuckets(bucketize(appts));
    } finally {
      setLoading(false);
    }
  }, [enabled, professionalId, clinicId]);

  useEffect(() => {
    if (!enabled || !professionalId) return;
    void fetchNow();
    timerRef.current = setInterval(() => { void fetchNow(); }, POLL_MS);

    // Re-fetch ao voltar do background
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
