import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Patient } from '../models/types';
import { supabase } from '../services/supabase';
import { hashCPF } from '../utils/cpfHash';
import { auditLog } from '../services/auditLog';

const STORAGE_KEY = '@oli:patients_v1';

interface PatientStore {
  patients:  Patient[];
  isLoaded:  boolean;
  setPatients:   (patients: Patient[]) => void;
  loadPatients:  () => Promise<void>;
  addPatient:    (data: Omit<Patient, 'id' | 'dataCadastro' | 'isSincronizado' | 'consentimentoTimestamp'> & { consentimentoTimestamp: string }, professionalId?: string) => Promise<void>;
  deletePatient: (id: string, professionalId?: string) => Promise<void>;
  markSynced:    (id: string) => Promise<void>;
  exportData:    () => string;
  syncWithCommunicare: (id: string, communicareId: string) => Promise<void>;
}

async function persist(patients: Patient[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

export const usePatientStore = create<PatientStore>((set, get) => ({
  patients: [],
  isLoaded: false,

  setPatients: (patients) => set({ patients, isLoaded: true }),

  loadPatients: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const patients: Patient[] = raw ? JSON.parse(raw) : [];
      set({ patients, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  addPatient: async (data, professionalId) => {
    // LGPD Art. 11 — CPF nunca armazenado em texto puro
    const cpfDigits = data.cpf?.replace(/\D/g, '') ?? '';
    const cpfHash   = cpfDigits.length === 11 ? await hashCPF(cpfDigits) : null;

    const newPatient: Patient = {
      ...data,
      cpf:             cpfDigits,   // mantido em memória (nunca persiste em texto)
      convenioTipo:    data.convenioTipo ?? 'particular',
      id:              `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      dataCadastro:    new Date().toISOString(),
      isSincronizado:  false,
    };

    // Salva no Supabase — persiste o HASH, nunca o CPF em texto
    if (professionalId) {
      await supabase.from('patients').insert({
        id:                     newPatient.id,
        professional_id:        professionalId,
        nome:                   newPatient.nome,
        telefone:               newPatient.telefone,
        cpf_hash:               cpfHash,            // ← hash SHA-256, não texto puro
        data_nascimento:        newPatient.dataNascimento || null,
        convenio_tipo:          newPatient.convenioTipo,
        convenio_nome:          newPatient.convenioNome ?? null,
        consentimento_timestamp: newPatient.consentimentoTimestamp,
        is_sincronizado:        false,
      });
    }

    // Persiste localmente sem o CPF em texto — substitui pelo hash
    const patientToStore: Patient = { ...newPatient, cpf: cpfHash ?? '' };
    const sorted = [...get().patients, patientToStore].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    );
    await persist(sorted);
    set({ patients: sorted });

    // Audit log — LGPD Art. 37
    if (professionalId) {
      auditLog(professionalId, {
        action:     'add_patient',
        targetType: 'patient',
        targetId:   newPatient.id,
      });
    }
  },

  deletePatient: async (id, professionalId?: string) => {
    // Audit log antes de remover
    if (professionalId) {
      await auditLog(professionalId, {
        action:     'delete_patient',
        targetType: 'patient',
        targetId:   id,
      });
    }
    const updated = get().patients.filter(p => p.id !== id);
    await persist(updated);
    set({ patients: updated });
  },

  markSynced: async (id) => {
    const updated = get().patients.map(p =>
      p.id === id ? { ...p, isSincronizado: true } : p,
    );
    await persist(updated);
    set({ patients: updated });
  },

  // LGPD Art. 18 — exporta TODOS os dados do titular em formato legível
  exportData: () => {
    return JSON.stringify(
      get().patients.map(p => ({
        nome:            p.nome,
        telefone:        p.telefone,
        dataNascimento:  p.dataNascimento,
        convenio:        p.convenioTipo === 'convenio' ? p.convenioNome : 'Particular',
        dataCadastro:    p.dataCadastro,
        consentimento:   p.consentimentoTimestamp,
        communicareId:   p.communicareId ?? 'não sincronizado',
        // CPF não exportado em texto puro — apenas confirmação de existência
        cpfRegistrado:   p.cpf ? 'sim' : 'não',
      })),
      null,
      2,
    );
  },

  syncWithCommunicare: async (id, communicareId) => {
    const updated = get().patients.map(p =>
      p.id === id ? { ...p, isSincronizado: true, communicareId } : p,
    );
    await persist(updated);
    set({ patients: updated });
  },
}));
