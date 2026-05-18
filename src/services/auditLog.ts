import { supabase } from './supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'view_patient'       // Abriu detalhes de um paciente
  | 'add_patient'        // Cadastrou novo paciente
  | 'delete_patient'     // Removeu paciente
  | 'export_data'        // Exportou dados (LGPD Art. 18)
  | 'view_onboarding'    // Acessou dados do questionário diagnóstico
  | 'login'              // Login realizado
  | 'logout';            // Logout realizado

export type AuditTargetType = 'patient' | 'profile' | 'reservation' | 'session';

interface AuditEntry {
  action:      AuditAction;
  targetType:  AuditTargetType;
  targetId?:   string;
  metadata?:   Record<string, string | number | boolean>;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

/**
 * Registra uma ação de acesso a dados sensíveis.
 * Falha silenciosa — nunca bloqueia a operação principal.
 * LGPD Art. 37: responsabilidade de registro do controlador.
 */
export async function auditLog(
  professionalId: string,
  entry: AuditEntry,
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      professional_id: professionalId,
      action:          entry.action,
      target_type:     entry.targetType,
      target_id:       entry.targetId ?? null,
      metadata:        entry.metadata ?? null,
    });
  } catch {
    // Log de auditoria nunca deve interromper o fluxo principal
    // Em produção: enviar para serviço externo como fallback
  }
}
