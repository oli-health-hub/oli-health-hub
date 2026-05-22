import { create } from 'zustand';
import type { Room, Reservation, PlanType } from '../models/types';
import { createReservation, deleteReservation, updateReservation } from '../services/reservationService';
import { logUsageCharge } from '../services/usageChargeService';
import {
  scheduleSessionNotifications,
  cancelSessionNotifications,
} from '../services/notificationService';
import { reportError, reportEvent } from '../services/sentryService';
import { useAuthStore } from './authStore';

// ─── Custo por minuto por plano (fonte: src/models/oli-plans.ts) ─────────────
// VIP ainda não lançado — usar 0 como fallback seguro (nunca deve cobrar)
export const COST_PER_MINUTE: Record<PlanType, number> = {
  START: 2.00,
  BASE:  1.70,
  PRO:   1.60,
  VIP:   0,    // coming_soon — sem cobrança até lançamento
};

const BUFFER_MS  = 15 * 60 * 1000; // 15 min
const CONFLICT_MS = 45 * 60 * 1000; // conflito se próxima reserva em < 45 min

// ─── Salas iniciais (substituídas pela API do Communicare na Fase 3) ──────────
const BASE_CLINICA = [
  'Maca convencional',
  'Balança',
  'Estadiômetro',
  'Mesa e cadeiras (profissional e paciente)',
  'Ar-condicionado',
];

const INITIAL_ROOMS: Room[] = [
  {
    id: 1, name: 'Sala 1', specialties: ['Ginecologia', 'Estética'], isAvailable: true,
    items: [
      'Maca ginecológica / estética',
      'Mesa e cadeiras (profissional e paciente)',
      'Ar-condicionado',
      'Banheiro',
    ],
  },
  {
    id: 2, name: 'Sala 2', specialties: ['Clínica Geral'], isAvailable: true,
    items: [...BASE_CLINICA, 'Banheiro'],
  },
  {
    id: 3, name: 'Sala 3', specialties: ['Clínica Geral'], isAvailable: false,
    items: BASE_CLINICA,
    note: 'Sugerida para Pediatria. Régua infantil e balança pediátrica disponíveis sob solicitação prévia.',
  },
  {
    id: 4, name: 'Sala 4', specialties: ['Clínica Geral'], isAvailable: true,
    items: BASE_CLINICA,
  },
  {
    id: 5, name: 'Sala 5', specialties: ['Clínica Geral'], isAvailable: true,
    items: BASE_CLINICA,
  },
  {
    id: 6, name: 'Sala 6', specialties: ['Psicologia'], isAvailable: true,
    items: [
      'Poltrona para o profissional',
      'Sofá para o paciente',
      'Mesa de apoio (profissional)',
      'Mesa de apoio (paciente)',
      'Iluminação indireta por luminária',
    ],
  },
  {
    id: 7, name: 'Sala Digital', specialties: ['Telemedicina', 'Criação de Conteúdo'], isAvailable: true,
    items: [
      'Poltrona',
      'TV',
      'Webcam',
      'Microfone de lapela',
      'Iluminação profissional',
      'Cenário de fundo',
      'Adaptador HDMI',
      'Ar-condicionado',
    ],
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

interface AppStore {
  userName:  string;
  userPlan:  PlanType;
  /** Duração padrão de consulta (min) — lida do perfil Communicare na inicialização */
  consultationDurationMinutes: number;

  sessionStartTime: Date | null;
  sessionEndTime:   Date | null;

  isInBuffer:          boolean;
  isOvertime:          boolean;
  hasNextReservation:  boolean;
  nextReservationTime: Date | null;

  todayReservations:    Reservation[];
  rooms:                Room[];
  /** ID da consulta ativa no Communicare — necessário para encerrar dos dois lados */
  activeConsultationId: string | null;

  // Actions
  startSession:   (startTime: Date, endTime: Date) => void;
  extendSession:  (extraMinutes: number) => void;
  checkout:       () => void;
  enterBuffer:    () => void;
  enterOvertime:  () => void;
  addReservation:    (reservation: Reservation) => void;
  cancelReservation: (id: string) => void;
  rescheduleReservation: (id: string, newStart: Date, newEnd: Date) => void;
  occupyCurrentRoom:     (roomName: string, professionalName: string) => void;
  startRoomUse:            (id: string) => void;
  endRoomUse:              (id: string) => void;
  setActiveConsultationId: (id: string | null) => void;
  setRooms:                (rooms: Room[]) => void;
  setTodayReservations:    (reservations: Reservation[]) => void;
  setConsultationDuration: (minutes: number) => void;
  setUserName:             (name: string) => void;
  _syncNextReservation:    () => void;
}

export const useAppStore = create<AppStore>((set, get) => {
  return {
    userName: '',
    userPlan: 'PRO',
    consultationDurationMinutes: 60,

    sessionStartTime: null,
    sessionEndTime:   null,

    isInBuffer:          false,
    isOvertime:          false,
    hasNextReservation:  false,
    nextReservationTime: null,

    todayReservations:    [],
    rooms:                INITIAL_ROOMS,
    activeConsultationId: null,

    startSession: (startTime, endTime) => {
      set({ sessionStartTime: startTime, sessionEndTime: endTime, isInBuffer: false, isOvertime: false });
      get()._syncNextReservation();
      // Agenda notificações locais — funcionam mesmo com app minimizado/morto
      const { hasNextReservation, rooms, todayReservations } = get();
      const roomName = todayReservations[0]?.roomName ?? 'Sala';
      scheduleSessionNotifications({
        sessionEndTime:    endTime,
        roomName,
        hasNextReservation,
      }).catch(() => {});
    },

    extendSession: (extraMinutes) => {
      const current = get().sessionEndTime;
      if (!current) return;
      const newEnd = new Date(current.getTime() + extraMinutes * 60 * 1000);
      set({ sessionEndTime: newEnd, isInBuffer: false, isOvertime: true });
      get()._syncNextReservation();
    },

    checkout: () => {
      cancelSessionNotifications().catch(() => {});
      set({ sessionStartTime: null, sessionEndTime: null, isInBuffer: false, isOvertime: false });
    },

    enterBuffer:   () => set({ isInBuffer: true,  isOvertime: false }),
    enterOvertime: () => get().extendSession(30),

    addReservation: (reservation) => {
      const sorted = [...get().todayReservations, reservation].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      set({ todayReservations: sorted });
      get()._syncNextReservation();
      // Sync Supabase em background
      const professionalId = useAuthStore.getState().session?.user?.id;
      if (professionalId) {
        createReservation(reservation, professionalId).catch(() => {});
      }
    },

    cancelReservation: (id) => {
      const target = get().todayReservations.find(r => r.id === id);
      const updatedReservations = get().todayReservations.filter(r => r.id !== id);
      const updatedRooms = target
        ? get().rooms.map(r =>
            r.name === target.roomName ? { ...r, isAvailable: true, occupiedBy: undefined } : r,
          )
        : get().rooms;
      set({ todayReservations: updatedReservations, rooms: updatedRooms });
      get()._syncNextReservation();
      deleteReservation(id).catch(() => {});
    },

    occupyCurrentRoom: (roomName, professionalName) => {
      const updated = get().rooms.map(r =>
        r.name === roomName
          ? { ...r, isAvailable: false, occupiedBy: professionalName }
          : r,
      );
      set({ rooms: updated });
    },

    startRoomUse: (id) => {
      const now = new Date().toISOString();
      set({
        todayReservations: get().todayReservations.map(r => {
          if (r.id === id)
            return { ...r, status: 'em_uso' as const, consultationStartedAt: now };
          if (r.status === 'em_uso')
            return { ...r, status: 'concluido' as const, consultationEndedAt: r.consultationEndedAt ?? now };
          return r;
        }),
      });
    },

    endRoomUse: (id) => {
      const now = new Date().toISOString();
      const { userPlan, todayReservations } = get();
      const target = todayReservations.find(r => r.id === id);

      set({
        todayReservations: todayReservations.map(r =>
          r.id === id
            ? { ...r, status: 'concluido' as const, consultationEndedAt: r.consultationEndedAt ?? now }
            : r,
        ),
        activeConsultationId: null,
      });

      // Registra cobrança por minutagem no Supabase em background
      if (target?.consultationStartedAt) {
        const professionalId = useAuthStore.getState().session?.user?.id;
        if (professionalId) {
          logUsageCharge({
            professionalId,
            reservationId:  target.id,
            plan:           userPlan,
            startedAt:      target.consultationStartedAt,
            endedAt:        target.consultationEndedAt ?? now,
          })
          .then(() => {
            reportEvent('usage_charge_logged', { plan: userPlan });
          })
          .catch((err: unknown) => {
            // Reporta ao Sentry sem PII — só o tipo de erro e plano
            reportError(err instanceof Error ? err : new Error(String(err)), {
              context: 'logUsageCharge',
              plan:    userPlan,
            });
          });
        }
      }
    },

    setActiveConsultationId: (id) => set({ activeConsultationId: id }),

    rescheduleReservation: (id, newStart, newEnd) => {
      const updated = get().todayReservations.map(r =>
        r.id === id
          ? { ...r, startTime: newStart.toISOString(), endTime: newEnd.toISOString() }
          : r,
      ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      set({ todayReservations: updated });
      get()._syncNextReservation();
      updateReservation(id, {
        start_time: newStart.toISOString(),
        end_time:   newEnd.toISOString(),
      }).catch(() => {});
    },

    setRooms: (rooms) => set({ rooms }),

    setTodayReservations: (reservations) => {
      set({ todayReservations: reservations });
      get()._syncNextReservation();
    },

    setConsultationDuration: (minutes) => set({ consultationDurationMinutes: minutes }),

    setUserName: (name) => set({ userName: name }),

    _syncNextReservation: () => {
      const { todayReservations, sessionEndTime } = get();
      if (!sessionEndTime || todayReservations.length < 2) {
        const endOfDay = new Date();
        endOfDay.setHours(22, 0, 0, 0);
        set({ hasNextReservation: false, nextReservationTime: endOfDay });
        return;
      }
      const next      = todayReservations[1];
      const nextStart = new Date(next.startTime);
      const gap       = nextStart.getTime() - sessionEndTime.getTime();
      set({ hasNextReservation: gap < CONFLICT_MS, nextReservationTime: nextStart });
    },
  };
});

// ─── Seletores puros (derivados — chamados fora do render com Date.now()) ─────

export function getElapsedSeconds(sessionStartTime: Date | null): number {
  if (!sessionStartTime) return 0;
  return Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
}

export function getCurrentCost(plan: PlanType, sessionStartTime: Date | null): number {
  return (getElapsedSeconds(sessionStartTime) / 60) * COST_PER_MINUTE[plan];
}

export function getTimerPhase(
  sessionEndTime: Date | null,
): { phase: 'normal' | 'buffer' | 'overtime'; remainingSeconds: number } {
  if (!sessionEndTime) return { phase: 'normal', remainingSeconds: 0 };
  const diff = Math.floor((sessionEndTime.getTime() - Date.now()) / 1000);
  if (diff > 0)           return { phase: 'normal',   remainingSeconds: diff };
  if (-diff <= 15 * 60)   return { phase: 'buffer',   remainingSeconds: Math.floor(BUFFER_MS / 1000) + diff };
  return                         { phase: 'overtime',  remainingSeconds: 0 };
}
