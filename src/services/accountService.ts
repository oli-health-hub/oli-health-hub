/**
 * accountService.ts
 *
 * LGPD Art. 18 — Direito ao esquecimento e portabilidade de dados.
 * Todas as operações passam por funções RPC no Supabase (SECURITY DEFINER),
 * garantindo que cada usuário só acesse e exclua seus próprios dados.
 */

import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// ── Exportação de dados ───────────────────────────────────────────────────────

export async function exportMyData(): Promise<void> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;

  const json     = JSON.stringify(data, null, 2);
  const filename = `oli-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  const uri      = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Exportar meus dados — OLI Health Hub',
    });
  } else {
    throw new Error('Compartilhamento não disponível neste dispositivo.');
  }
}

// ── Exclusão de conta ─────────────────────────────────────────────────────────

export interface DeleteAccountResult {
  deletedPatients:     number;
  deletedReservations: number;
  deletedCharges:      number;
}

export async function deleteAccountData(userId: string): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.rpc('delete_account_data', {
    p_user_id: userId,
  });
  if (error) throw error;

  // Após apagar dados, faz signOut para invalidar a sessão
  await supabase.auth.signOut();

  return {
    deletedPatients:     data.deleted_patients     ?? 0,
    deletedReservations: data.deleted_reservations ?? 0,
    deletedCharges:      data.deleted_charges      ?? 0,
  };
}
