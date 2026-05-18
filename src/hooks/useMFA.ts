import { useState } from 'react';
import { supabase } from '../services/supabase';

export type MFAStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MFAEnrollData {
  factorId: string;
  qrCode:   string;   // data URI para exibir no app
  secret:   string;   // código manual caso QR não leia
}

// ─── Verifica se o usuário tem MFA obrigatório pendente ──────────────────────

export async function checkMFARequired(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  // aal1 = autenticado só com senha; aal2 = passou pelo TOTP
  // Se nextLevel é aal2 mas currentLevel é aal1 → MFA pendente
  return data.nextLevel === 'aal2' && data.currentLevel === 'aal1';
}

// ─── Hook: enrolar novo fator TOTP ──────────────────────────────────────────

export function useMFAEnroll() {
  const [status,     setStatus]     = useState<MFAStatus>('idle');
  const [enrollData, setEnrollData] = useState<MFAEnrollData | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const startEnroll = async () => {
    setStatus('loading');
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType:   'totp',
        friendlyName: 'OLI Health Hub',
      });
      if (err) throw err;
      setEnrollData({
        factorId: data.id,
        qrCode:   data.totp.qr_code,
        secret:   data.totp.secret,
      });
      setStatus('idle');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar configuração do MFA');
      setStatus('error');
    }
  };

  const verifyEnroll = async (code: string): Promise<boolean> => {
    if (!enrollData) return false;
    setStatus('loading');
    try {
      const { data: challenge } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      });
      if (!challenge) throw new Error('Falha ao criar challenge');

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId:    enrollData.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) throw verifyErr;

      setStatus('success');
      return true;
    } catch (e: unknown) {
      setError('Código inválido. Verifique o app autenticador.');
      setStatus('error');
      return false;
    }
  };

  return { status, enrollData, error, startEnroll, verifyEnroll };
}

// ─── Hook: verificar TOTP no login (aal1 → aal2) ───────────────────────────

export function useMFAVerify() {
  const [status, setStatus] = useState<MFAStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);

  const verify = async (code: string): Promise<boolean> => {
    setStatus('loading');
    setError(null);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (!totp) throw new Error('Nenhum fator TOTP encontrado');

      const { data: challenge } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (!challenge) throw new Error('Falha ao criar challenge');

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId:    totp.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) throw verifyErr;

      setStatus('success');
      return true;
    } catch (e: unknown) {
      setError('Código inválido ou expirado. Tente novamente.');
      setStatus('error');
      return false;
    }
  };

  return { status, error, verify };
}
