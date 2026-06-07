/**
 * Communicare Sync Orchestrator
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincronização automática e silenciosa.
 * - Erros NÃO viram badge vermelho — viram retry interno.
 * - UI vê apenas 'synced' ou 'pending' (+ % de progresso).
 * - 5 tentativas falhas → alerta admin (não médico).
 *
 * Fluxo paciente:
 *   etapa 1 (20%)  Validar CPF local
 *   etapa 2 (40%)  Dedup: GET /patient?cpf=X
 *   etapa 3 (70%)  POST /patient (ou vincula existente)
 *   etapa 4 (90%)  Grava communicare_id em patients
 *   etapa 5 (100%) Audit log
 */

import { supabase } from './supabase';
// `database.types.ts` é regenerado após aplicar a migração 20260601_communicare_sync.sql.
// Até lá, usamos um cliente sem tipos para colunas/tabelas novas.
// deno-lint-ignore no-explicit-any
const sb: any = supabase;
import {
  ccCreatePatient,
  ccUpdatePatient,
  ccDeletePatient,
  ccFindPatientByCPF,
  ccIsConfigured,
  CCApiError,
  type CCPatient,
} from './communicareApi';
import type { Patient } from '../models/types';

// ─── Progress helpers ────────────────────────────────────────────────────────

async function updateProgress(patientId: string, progress: number) {
  await sb
    .from('patients')
    .update({ sync_progress: progress })
    .eq('id', patientId);
}

async function markSynced(patientId: string, communicareId: string) {
  await sb
    .from('patients')
    .update({
      sync_status:    'synced',
      sync_progress:  100,
      synced_at:      new Date().toISOString(),
      communicare_id: communicareId,
      last_sync_error: null,
    })
    .eq('id', patientId);
}

async function markPending(patientId: string, error: string) {
  // Status nunca vira 'error' na UI. Erro vai pra coluna interna.
  await sb
    .from('patients')
    .update({
      sync_status:      'pending',
      last_sync_error:  error,
    })
    .eq('id', patientId);

  // Incrementa tentativa
  const { data } = await sb
    .from('patients')
    .select('sync_attempt_count')
    .eq('id', patientId)
    .single();
  const count = (data?.sync_attempt_count ?? 0) + 1;
  await sb
    .from('patients')
    .update({ sync_attempt_count: count })
    .eq('id', patientId);
}

// ─── Sync paciente (chamado após addPatient) ─────────────────────────────────

export interface SyncPatientInput {
  patientId:        string;
  nome:             string;
  cpfClear:         string;   // CPF cleartext SÓ pra trafegar com CC
  telefone:         string;
  dataNascimento:   string;   // YYYY-MM-DD
  email?:           string;
  healthPlanId?:    string;
}

export async function syncPatientToCC(input: SyncPatientInput): Promise<{ ok: boolean; ccId?: string }> {
  if (!ccIsConfigured()) {
    // Sem token CC ainda — deixa pending, processa quando configurar
    return { ok: false };
  }

  try {
    // Etapa 1: validar CPF
    const cpfDigits = input.cpfClear.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      await markPending(input.patientId, 'CPF inválido');
      return { ok: false };
    }
    await updateProgress(input.patientId, 20);

    // Etapa 2: dedup por CPF
    const existing = await ccFindPatientByCPF(cpfDigits);
    await updateProgress(input.patientId, 40);

    let ccId: string;
    if (existing?.id) {
      ccId = existing.id;
    } else {
      // Etapa 3: cria no CC
      const payload: CCPatient = {
        name:          input.nome,
        cpf:           cpfDigits,
        birthDate:     input.dataNascimento,
        phone:         input.telefone,
        email:         input.email,
        healthPlanId:  input.healthPlanId,
        externalId:    input.patientId,   // vínculo OLI ↔ CC
      };
      const created = await ccCreatePatient(payload);
      ccId = created.id ?? '';
      if (!ccId) {
        await markPending(input.patientId, 'CC não retornou id');
        return { ok: false };
      }
    }
    await updateProgress(input.patientId, 70);

    // Etapa 4: grava cc_id
    await sb
      .from('patients')
      .update({ communicare_id: ccId })
      .eq('id', input.patientId);
    await updateProgress(input.patientId, 90);

    // Etapa 5: marca synced
    await markSynced(input.patientId, ccId);
    return { ok: true, ccId };

  } catch (e) {
    const msg = e instanceof CCApiError
      ? `CC ${e.status}: ${e.message}`
      : (e instanceof Error ? e.message : 'erro desconhecido');
    await markPending(input.patientId, msg);
    // Enfileira para retry pelo Edge Function cron
    await enqueueRetry('patient', input.patientId, 'create', input);
    return { ok: false };
  }
}

// ─── Update paciente (CC) ────────────────────────────────────────────────────

export interface UpdatePatientCCInput {
  communicareId: string;
  nome?:         string;
  telefone?:     string;
  email?:        string;
  healthPlanId?: string;
}

export async function updatePatientCC(input: UpdatePatientCCInput): Promise<boolean> {
  if (!ccIsConfigured() || !input.communicareId) return false;
  try {
    const payload: Partial<CCPatient> = {};
    if (input.nome      !== undefined) payload.name         = input.nome;
    if (input.telefone  !== undefined) payload.phone        = input.telefone;
    if (input.email     !== undefined) payload.email        = input.email;
    if (input.healthPlanId !== undefined) payload.healthPlanId = input.healthPlanId;
    await ccUpdatePatient(input.communicareId, payload);
    return true;
  } catch {
    return false;
  }
}

// ─── Delete paciente (CC) ────────────────────────────────────────────────────

export async function deletePatientCC(communicareId: string): Promise<boolean> {
  if (!ccIsConfigured() || !communicareId) return false;
  try {
    await ccDeletePatient(communicareId);
    return true;
  } catch {
    // Falha silenciosa — paciente já removido localmente; CC fica eventual
    return false;
  }
}

// ─── Fila de retry ───────────────────────────────────────────────────────────

export async function enqueueRetry(
  entityType: 'patient' | 'reservation' | 'profile',
  entityId:   string,
  action:     'create' | 'update' | 'delete',
  payload:    unknown,
): Promise<void> {
  // Backoff exponencial: 30s, 2min, 10min, 1h, 6h
  const { data } = await sb
    .from('patients')
    .select('sync_attempt_count')
    .eq('id', entityId)
    .single();
  const attempts = data?.sync_attempt_count ?? 0;
  const delaysMs = [30_000, 120_000, 600_000, 3_600_000, 21_600_000];
  const delay    = delaysMs[Math.min(attempts, delaysMs.length - 1)];
  const nextAt   = new Date(Date.now() + delay).toISOString();

  await sb.from('communicare_sync_queue').insert({
    entity_type:     entityType,
    entity_id:       entityId,
    action,
    payload:         payload as Record<string, unknown>,
    next_attempt_at: nextAt,
  });
}

// ─── Retry on-demand (chamado ao abrir lista pacientes) ──────────────────────

export async function retryPendingSyncs(professionalId: string): Promise<void> {
  if (!ccIsConfigured()) return;

  const { data } = await sb
    .from('patients')
    .select('id, nome, telefone, data_nascimento, cpf_hash')
    .eq('professional_id', professionalId)
    .eq('sync_status', 'pending')
    .limit(10);

  if (!data) return;
  // Reprocessa apenas os que têm CPF hash (já cadastrados); CPF cleartext
  // ficou só na sessão original — para retry batch precisa do queue payload.
  for (const p of data) {
    const { data: queueItem } = await sb
      .from('communicare_sync_queue')
      .select('payload')
      .eq('entity_id', p.id)
      .eq('processed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (queueItem?.payload) {
      await syncPatientToCC(queueItem.payload as SyncPatientInput);
    }
  }
}

// ─── Helper de status visível (Patient → UI) ─────────────────────────────────

export type PatientSyncBadge =
  | { kind: 'synced'; syncedAt: string }
  | { kind: 'pending'; progress: number };

export function badgeFromPatient(p: Patient & {
  sync_status?:   'synced' | 'pending';
  sync_progress?: number;
  synced_at?:     string;
}): PatientSyncBadge {
  if (p.sync_status === 'synced' && p.synced_at) {
    return { kind: 'synced', syncedAt: p.synced_at };
  }
  return { kind: 'pending', progress: p.sync_progress ?? 0 };
}
