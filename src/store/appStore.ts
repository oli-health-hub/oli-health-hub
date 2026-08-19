import { create } from 'zustand';
import type { Room, Reservation, PlanType } from '../models/types';
import {
  createReservation, deleteReservation, updateReservation,
  fetchRoomOccupancy, isRoomConflictError,
} from '../services/reservationService';
import { logUsageCharge } from '../services/usageChargeService';
import {
  scheduleSessionNotifications,
  cancelSessionNotifications,
} from '../services/notificationService';
import { reportError, reportEvent } from '../services/sentryService';
import { useAuthStore } from './authStore';
import { PLANS } from '../models/oli-plans';

// ─── Custo por minuto por plano (DERIVADO de oli-plans.ts) ───────────────────
// Fonte única de verdade. VIP ainda não lançado → ratePerMinute null → 0.
export const COST_PER_MINUTE: Record<PlanType, number> = {
  START: PLANS.plan_start.ratePerMinute ?? 0,
  BASE:  PLANS.plan_base.ratePerMinute  ?? 0,
  PRO:   PLANS.plan_pro.ratePerMinute   ?? 0,
  VIP:   PLANS.plan_vip.ratePerMinute   ?? 0,
};

const BUFFER_MS  = 15 * 60 * 1000; // 15 min
const CONFLICT_MS = 45 * 60 * 1000; // conflito se próxima reserva em < 45 min

const isToday = (iso: string) => {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
};

// ─── Salas iniciais (substituídas pela API do Communicare na Fase 3) ──────────
const BASE_CLINICA = [
  'Maca convencional',
  'Balança',
  'Estadiômetro',
  'Mesa e cadeiras (profissional e paciente)',
  'Ar-condicionado',
];

const BASE_AV = [
  'TV / Monitor',
  'Webcam',
  'Microfone de lapela',
  'Iluminação profissional',
  'Cenário de fundo',
  'Adaptador HDMI',
  'Ar-condicionado',
];

const INITIAL_ROOMS: Room[] = [
  {
    id: 1, name: 'Sala 1', specialties: ['Vídeo Conferência'], isAvailable: true,
    items: BASE_AV,
  },
  {
    id: 2, name: 'Sala 2', specialties: ['Psicologia'], isAvailable: true,
    items: [
      'Poltrona para o profissional',
      'Sofá para o paciente',
      'Mesa de apoio (profissional)',
      'Mesa de apoio (paciente)',
      'Iluminação indireta por luminária',
    ],
  },
  {
    id: 3, name: 'Sala 3', specialties: ['Clínica Geral'], isAvailable: true,
    items: BASE_CLINICA,
  },
  {
    id: 4, name: 'Sala 4', specialties: ['Audio Visual'], isAvailable: true,
    items: BASE_AV,
  },
  {
    id: 5, name: 'Sala 5', specialties: ['Clínica Geral'], isAvailable: true,
    items: BASE_CLINICA,
  },
  {
    id: 6, name: 'Sala 6', specialties: ['Clínica Geral'], isAvailable: true,
    items: BASE_CLINICA,
  },
  {
    id: 7, name: 'Sala 7', specialties: ['Clínica Geral'], isAvailable: true,
    items: BASE_CLINICA,
  },
  {
    id: 8, name: 'Sala 8', specialties: ['Ginecologia', 'Estética'], isAvailable: true,
    items: [
      'Maca ginecológica / estética',
      'Mesa e cadeiras (profissional e paciente)',
      'Ar-condicionado',
      'Banheiro',
    ],
  },
  {
    id: 9, name: 'Sala 9', specialties: ['Eventos'], isAvailable: true,
    items: [
      'Mesas e cadeiras para grupo',
      'Projetor / TV',
      'Quadro branco',
      'Ar-condicionado',
      'Água e copos',
    ],
    note: 'Reservada por bloco/hora (não por minutagem).',
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
  /** Reservas de hoje até ~180 dias à frente — usada por agenda, encaixe e reagendamento (checagem de conflito não pode se limitar a hoje). */
  upcomingReservations: Reservation[];
  /** Ocupação de sala de TODOS os profissionais (via RPC, RLS não expõe a tabela direto) — única fonte confiável pra checar conflito de sala/horário entre médicos diferentes. */
  roomOccupancy:        Reservation[];
  rooms:                Room[];
  /** ID da consulta ativa no Communicare — necessário para encerrar dos dois lados */
  activeConsultationId: string | null;

  // Actions
  startSession:   (startTime: Date, endTime: Date) => void;
  extendSession:  (extraMinutes: number) => void;
  checkout:       () => void;
  enterBuffer:    () => void;
  enterOvertime:  () => void;
  /** Lança se o servidor rejeitar (ex.: conflito de sala — exclusion constraint) — reverte o otimismo local nesse caso. */
  addReservation:    (reservation: Reservation) => Promise<void>;
  cancelReservation: (id: string) => void;
  /** Lança se o servidor rejeitar (ex.: conflito de sala — exclusion constraint) — reverte o otimismo local nesse caso. */
  rescheduleReservation: (id: string, newStart: Date, newEnd: Date) => Promise<void>;
  occupyCurrentRoom:     (roomName: string, professionalName: string) => void;
  startRoomUse:            (id: string) => void;
  endRoomUse:              (id: string) => void;
  setActiveConsultationId: (id: string | null) => void;
  setRooms:                (rooms: Room[]) => void;
  setUpcomingReservations: (reservations: Reservation[]) => void;
  setRoomOccupancy:        (reservations: Reservation[]) => void;
  setConsultationDuration: (minutes: number) => void;
  setUserName:             (name: string) => void;
  setUserPlan:             (plan: PlanType) => void;
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
    upcomingReservations: [],
    roomOccupancy:        [],
    rooms:                INITIAL_ROOMS,
    activeConsultationId: null,

    startSession: (startTime, endTime) => {
      set({ sessionStartTime: startTime, sessionEndTime: endTime, isInBuffer: false, isOvertime: false });
      get()._syncNextReservation();

      // Marca a primeira reserva pendente como em_uso e registra consultationStartedAt
      // para que endRoomUse possa calcular e cobrar o tempo consumido corretamente
      const { hasNextReservation, rooms, todayReservations } = get();
      const firstPending = todayReservations.find(
        r => r.status !== 'concluido' && r.status !== 'cancelado',
      );
      if (firstPending && !firstPending.consultationStartedAt) {
        const now = new Date().toISOString();
        const patch = (r: Reservation) =>
          r.id === firstPending.id
            ? { ...r, status: 'em_uso' as const, consultationStartedAt: now }
            : r;
        set({
          todayReservations:    get().todayReservations.map(patch),
          upcomingReservations: get().upcomingReservations.map(patch),
        });
        updateReservation(firstPending.id, {
          status:                    'em_uso',
          consultation_started_at:   now,
        }).catch(() => {});
      }

      // Agenda notificações locais — funcionam mesmo com app minimizado/morto
      const roomName = firstPending?.roomName ?? todayReservations[0]?.roomName ?? 'Sala';
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

    addReservation: async (reservation) => {
      const byStart = (a: Reservation, b: Reservation) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      const prevUpcoming  = get().upcomingReservations;
      const prevOccupancy = get().roomOccupancy;
      const upcoming = [...prevUpcoming, reservation].sort(byStart);
      set({
        upcomingReservations: upcoming,
        todayReservations:    upcoming.filter(r => isToday(r.startTime)),
        roomOccupancy:        [...prevOccupancy, reservation].sort(byStart),
      });
      get()._syncNextReservation();

      const professionalId = useAuthStore.getState().session?.user?.id;
      if (!professionalId) return;
      try {
        await createReservation(reservation, professionalId);
      } catch (err) {
        // Servidor rejeitou (ex.: outro profissional reservou a mesma sala/horário primeiro) — reverte o otimismo local
        set({
          upcomingReservations: prevUpcoming,
          todayReservations:    prevUpcoming.filter(r => isToday(r.startTime)),
          roomOccupancy:        prevOccupancy,
        });
        get()._syncNextReservation();
        if (isRoomConflictError(err)) {
          fetchRoomOccupancy().then(o => set({ roomOccupancy: o })).catch(() => {});
        }
        throw err;
      }
    },

    cancelReservation: (id) => {
      const target = get().upcomingReservations.find(r => r.id === id);
      const upcoming = get().upcomingReservations.filter(r => r.id !== id);
      const updatedRooms = target
        ? get().rooms.map(r =>
            r.name === target.roomName ? { ...r, isAvailable: true, occupiedBy: undefined } : r,
          )
        : get().rooms;
      set({
        upcomingReservations: upcoming,
        todayReservations:    upcoming.filter(r => isToday(r.startTime)),
        roomOccupancy:        get().roomOccupancy.filter(r => r.id !== id),
        rooms:                updatedRooms,
      });
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
      const patch = (r: Reservation) => {
        if (r.id === id)
          return { ...r, status: 'em_uso' as const, consultationStartedAt: now };
        if (r.status === 'em_uso')
          return { ...r, status: 'concluido' as const, consultationEndedAt: r.consultationEndedAt ?? now };
        return r;
      };
      set({
        todayReservations:    get().todayReservations.map(patch),
        upcomingReservations: get().upcomingReservations.map(patch),
      });
    },

    endRoomUse: (id) => {
      const now = new Date().toISOString();
      const { userPlan, todayReservations } = get();
      const target = todayReservations.find(r => r.id === id);
      const patch = (r: Reservation) =>
        r.id === id
          ? { ...r, status: 'concluido' as const, consultationEndedAt: r.consultationEndedAt ?? now }
          : r;

      set({
        todayReservations:    todayReservations.map(patch),
        upcomingReservations: get().upcomingReservations.map(patch),
        activeConsultationId: null,
      });

      // Persiste status concluído no Supabase — impede que o fetch de reservas
      // sobrescreva o estado local e reinicie o timer ao reabrir o app
      updateReservation(id, {
        status:                'concluido',
        consultation_ended_at: target?.consultationEndedAt ?? now,
      }).catch((err: unknown) => {
        reportError(err instanceof Error ? err : new Error(String(err)), {
          context: 'endRoomUse.updateStatus',
        });
      });

      // Registra cobrança por minutagem no Supabase em background
      // Fallback: usa startTime da reserva caso consultationStartedAt não esteja setado
      const startedAt = target?.consultationStartedAt ?? target?.startTime;
      if (startedAt && target) {
        const professionalId = useAuthStore.getState().session?.user?.id;
        if (professionalId) {
          logUsageCharge({
            professionalId,
            reservationId:     target.id,
            plan:              userPlan,
            taxaMinOverride:   useAuthStore.getState().profile?.taxa_min_congelada,
            startedAt,
            endedAt:           target.consultationEndedAt ?? now,
            scheduledEndTime:  target.endTime,   // excedente cobrado em blocos de 30 min
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

    rescheduleReservation: async (id, newStart, newEnd) => {
      const patch = (r: Reservation) =>
        r.id === id
          ? { ...r, startTime: newStart.toISOString(), endTime: newEnd.toISOString() }
          : r;
      const prevUpcoming  = get().upcomingReservations;
      const prevOccupancy = get().roomOccupancy;
      const upcoming = prevUpcoming.map(patch).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      set({
        upcomingReservations: upcoming,
        todayReservations:    upcoming.filter(r => isToday(r.startTime)),
        roomOccupancy:        prevOccupancy.map(patch),
      });
      get()._syncNextReservation();
      try {
        await updateReservation(id, {
          start_time: newStart.toISOString(),
          end_time:   newEnd.toISOString(),
        });
      } catch (err) {
        // Servidor rejeitou (ex.: sala já ocupada nesse horário por outro profissional) — reverte o otimismo local
        set({
          upcomingReservations: prevUpcoming,
          todayReservations:    prevUpcoming.filter(r => isToday(r.startTime)),
          roomOccupancy:        prevOccupancy,
        });
        get()._syncNextReservation();
        if (isRoomConflictError(err)) {
          fetchRoomOccupancy().then(o => set({ roomOccupancy: o })).catch(() => {});
        }
        throw err;
      }
    },

    setRooms: (rooms) => set({ rooms }),

    setUpcomingReservations: (reservations) => {
      set({
        upcomingReservations: reservations,
        todayReservations:    reservations.filter(r => isToday(r.startTime)),
      });
      get()._syncNextReservation();
    },

    setRoomOccupancy: (reservations) => set({ roomOccupancy: reservations }),

    setConsultationDuration: (minutes) => set({ consultationDurationMinutes: minutes }),

    setUserName: (name) => set({ userName: name }),

    setUserPlan: (plan) => set({ userPlan: plan }),

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

export function getCurrentCost(
  plan: PlanType,
  sessionStartTime: Date | null,
  rateOverride?: number | null,
): number {
  const taxaMin = rateOverride ?? COST_PER_MINUTE[plan];
  return (getElapsedSeconds(sessionStartTime) / 60) * taxaMin;
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
