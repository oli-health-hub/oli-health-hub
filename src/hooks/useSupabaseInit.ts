import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { usePatientStore } from '../store/patientStore';
import { fetchRooms } from '../services/roomService';
import { fetchTodayReservations } from '../services/reservationService';
import { supabase } from '../services/supabase';
import type { Patient, PlanType } from '../models/types';

export function useSupabaseInit() {
  const { session, profile } = useAuthStore();
  const { setRooms, setTodayReservations, setConsultationDuration, setUserName, setUserPlan } = useAppStore();
  const { setPatients } = usePatientStore();

  useEffect(() => {
    if (!session?.user) return;

    const userId = session.user.id;

    // Atualiza nome, plano e duração padrão de consulta a partir do perfil
    if (profile) {
      setUserName(profile.nome);
      setConsultationDuration(profile.consultation_duration_minutes);
      if (profile.plan) setUserPlan(profile.plan as PlanType);
    }

    // Carrega salas e reservas do dia em paralelo
    Promise.all([
      fetchRooms(),
      fetchTodayReservations(userId),
    ]).then(([rooms, reservations]) => {
      setRooms(rooms);
      setTodayReservations(reservations);
    }).catch(() => {
      // Mantém dados locais em caso de falha de rede
    });

    // Carrega pacientes do profissional
    supabase
      .from('patients')
      .select('*')
      .eq('professional_id', userId)
      .order('nome')
      .then(({ data }) => {
        if (!data) return;
        const patients: Patient[] = data.map(p => ({
          id:                     p.id,
          nome:                   p.nome,
          telefone:               p.telefone,
          cpf:                    p.cpf_hash ?? '',
          dataNascimento:         p.data_nascimento ?? '',
          convenioTipo:           (p.convenio_tipo as 'particular' | 'convenio'),
          convenioNome:           p.convenio_nome ?? undefined,
          isSincronizado:         p.is_sincronizado,
          consentimentoTimestamp: p.consentimento_timestamp ?? new Date().toISOString(),
          dataCadastro:           p.created_at,
          communicareId:          p.communicare_id ?? undefined,
        }));
        setPatients(patients);
      });
  }, [session?.user?.id, profile]);
}
