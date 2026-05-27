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
  loadPatients:  (professionalId?: string) => Promise<void>;
  addPatient:    (data: Omit<Patient, 'id' | 'dataCadastro' | 'isSincronizado' | 'consentimentoTimestamp'> & { consentimentoTimestamp: string }, professionalId?: string) => Promise<{ consentToken: string }>;
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

  loadPatients: async (professionalId?: string) => {
    try {
      // 1. Carrega cache local imediatamente (UX rápida)
      const raw   = await AsyncStorage.getItem(STORAGE_KEY);
      const local: Patient[] = raw ? JSON.parse(raw) : [];
      if (local.length > 0) set({ patients: local, isLoaded: true });

      // 2. Supabase é a fonte de verdade — sincroniza em seguida
      if (professionalId) {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('professional_id', professionalId)
          .order('nome', { ascending: true });

        if (!error && data) {
          const remote: Patient[] = data.map(row => ({
            id:                     row.id,
            nome:                   row.nome,
            telefone:               row.telefone,
            cpf:                    row.cpf_hash ?? '',     // hash, nunca texto puro
            dataNascimento:         row.data_nascimento ?? '',
            convenioTipo:           (row.convenio_tipo as Patient['convenioTipo']) ?? 'particular',
            convenioNome:           row.convenio_nome ?? undefined,
            dataCadastro:           row.created_at ?? new Date().toISOString(),
            consentimentoTimestamp: row.consentimento_timestamp ?? '',
            isSincronizado:         row.is_sincronizado ?? false,
            communicareId:          row.communicare_id ?? undefined,
          }));
          // Supabase sobrescreve cache local
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
          set({ patients: remote, isLoaded: true });
        }
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  addPatient: async (data, professionalId) => {
    // LGPD Art. 11 — CPF nunca armazenado em texto puro
    const cpfDigits = data.cpf?.replace(/\D/g, '') ?? '';
    const cpfHash   = cpfDigits.length === 11 ? await hashCPF(cpfDigits) : null;

    // Converte DD/MM/AAAA → YYYY-MM-DD para o Supabase (tipo date)
    function toBRDateToISO(br: string): string | null {
      if (!br || br.length !== 10) return null;
      const [dd, mm, yyyy] = br.split('/');
      if (!dd || !mm || !yyyy) return null;
      return `${yyyy}-${mm}-${dd}`;
    }

    // Gera UUID v4 compatível com o banco
    function genUUID(): string {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }

    const newId            = genUUID();
    const consentToken     = genUUID(); // token para link de consentimento LGPD

    const newPatient: Patient = {
      ...data,
      cpf:             cpfDigits,   // mantido em memória (nunca persiste em texto)
      convenioTipo:    data.convenioTipo ?? 'particular',
      id:              newId,
      dataCadastro:    new Date().toISOString(),
      isSincronizado:  false,
    };

    // Salva no Supabase — persiste o HASH, nunca o CPF em texto
    let finalConsentToken = consentToken;
    if (professionalId) {
      const { data: inserted, error } = await supabase.from('patients').insert({
        id:                      newPatient.id,
        professional_id:         professionalId,
        nome:                    newPatient.nome,
        telefone:                newPatient.telefone,
        cpf_hash:                cpfHash,                              // hash SHA-256
        data_nascimento:         toBRDateToISO(newPatient.dataNascimento ?? ''), // YYYY-MM-DD ou null
        convenio_tipo:           newPatient.convenioTipo,
        convenio_nome:           newPatient.convenioNome ?? null,
        consentimento_timestamp: null,                                 // null = aguardando
        consentimento_token:     consentToken,
        is_sincronizado:         false,
      }).select('id, consentimento_token').single();

      if (error) throw new Error(error.message);
      // Usa valores retornados pelo banco
      if (inserted?.id) newPatient.id = inserted.id;
      if (inserted?.consentimento_token) finalConsentToken = inserted.consentimento_token;
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

    return { consentToken: finalConsentToken };
  },

  deletePatient: async (id, professionalId?: string) => {
    // Audit log antes de remover
    if (professionalId) {
      await auditLog(professionalId, {
        action:     'delete_patient',
        targetType: 'patient',
        targetId:   id,
      });
      // Remove do Supabase (RLS garante que só o dono pode deletar)
      await supabase.from('patients').delete().eq('id', id);
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
