import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Patient } from '../models/types';
import { supabase } from '../services/supabase';
import { hashCPF } from '../utils/cpfHash';
import { auditLog } from '../services/auditLog';
import { syncPatientToCC, deletePatientCC, retryPendingSyncs } from '../services/communicareSync';

const STORAGE_KEY = '@oli:patients_v1';

interface PatientStore {
  patients:  Patient[];
  isLoaded:  boolean;
  setPatients:   (patients: Patient[]) => void;
  loadPatients:  (professionalId?: string) => Promise<void>;
  addPatient:    (data: Omit<Patient, 'id' | 'dataCadastro' | 'isSincronizado' | 'consentimentoTimestamp'> & { consentimentoTimestamp: string; email?: string; healthPlanId?: string }, professionalId?: string) => Promise<{ consentToken: string }>;
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
          const remote: Patient[] = data.map((rowRaw) => {
            const row = rowRaw as unknown as Record<string, unknown> & typeof rowRaw;
            return ({
            id:                     row.id,
            nome:                   row.nome,
            telefone:               row.telefone,
            cpf:                    row.cpf_hash ?? '',     // hash, nunca texto puro
            dataNascimento:         row.data_nascimento ?? '',
            convenioTipo:           (row.convenio_tipo as Patient['convenioTipo']) ?? 'particular',
            convenioNome:           row.convenio_nome ?? undefined,
            dataCadastro:           row.created_at ?? new Date().toISOString(),
            consentimentoTimestamp: row.consentimento_timestamp ?? new Date().toISOString(),
            isSincronizado:         row.is_sincronizado ?? false,
            communicareId:          row.communicare_id ?? undefined,
            syncStatus:             (row.sync_status as 'synced' | 'pending' | undefined) ?? 'pending',
            syncProgress:           (row.sync_progress as number | undefined) ?? 0,
            syncedAt:               (row.synced_at as string | undefined) ?? undefined,
          });
          });
          // Supabase sobrescreve cache local
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
          set({ patients: remote, isLoaded: true });

          // Reprocessa pacientes com sync pendente (silencioso)
          void retryPendingSyncs(professionalId);
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

    const newId             = genUUID();
    const localConsentToken = genUUID(); // fallback caso insert falhe e não retorne token

    const newPatient: Patient = {
      ...data,
      cpf:             cpfDigits,   // mantido em memória (nunca persiste em texto)
      convenioTipo:    data.convenioTipo ?? 'particular',
      id:              newId,
      dataCadastro:    new Date().toISOString(),
      isSincronizado:  false,
    };

    // Token retornado pelo banco — usado no link de consentimento LGPD
    let consentToken = localConsentToken;

    // Salva no Supabase — persiste o HASH, nunca o CPF em texto
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
        // consentimento_timestamp NÃO é setado — fica null até paciente clicar no link
        is_sincronizado:         false,
      }).select('id, consentimento_token').single();

      if (error) throw new Error(error.message);
      if (inserted?.id) newPatient.id = inserted.id;
      // CRÍTICO: usa o token gerado pelo DB (defaut gen_random_uuid) — bate com edge function
      if (inserted?.consentimento_token) consentToken = inserted.consentimento_token as string;
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

    // Sync Communicare em background — UI mostra badge "Sincronizando %"
    // CPF cleartext (cpfDigits) usado só nesta chamada via HTTPS, não persiste.
    if (professionalId && cpfDigits.length === 11) {
      void syncPatientToCC({
        patientId:      newPatient.id,
        nome:           newPatient.nome,
        cpfClear:       cpfDigits,
        telefone:       newPatient.telefone,
        dataNascimento: toBRDateToISO(newPatient.dataNascimento ?? '') ?? '',
        email:          data.email,
        healthPlanId:   data.healthPlanId,
      }).then(async (res) => {
        if (res.ok && res.ccId) {
          // Atualiza store local com badge synced
          const updated = get().patients.map(p =>
            p.id === newPatient.id
              ? { ...p, syncStatus: 'synced' as const, syncProgress: 100, syncedAt: new Date().toISOString(), communicareId: res.ccId, isSincronizado: true }
              : p,
          );
          await persist(updated);
          set({ patients: updated });
        }
      });
    }

    return { consentToken };
  },

  deletePatient: async (id, professionalId?: string) => {
    // Captura communicare_id antes de remover — para propagar delete ao CC
    const ccId = get().patients.find(p => p.id === id)?.communicareId;
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
    // Propaga delete ao Communicare (silencioso)
    if (ccId) void deletePatientCC(ccId);
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
