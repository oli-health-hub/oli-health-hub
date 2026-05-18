import { Linking } from 'react-native';
import { formatDate, formatHour } from './formatters';

// Lido do ambiente de build — definido em .env (nunca hardcoded)
// EXPO_PUBLIC_* são injetadas pelo Metro no bundle do cliente
const OLI_RECEPTION_PHONE =
  process.env.EXPO_PUBLIC_OLI_RECEPTION_PHONE ?? '5511997639711';

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

async function openWhatsApp(phone: string, message: string): Promise<boolean> {
  const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;
  await Linking.openURL(url);
  return true;
}

/** Abre WhatsApp com a recepção do OLI */
export async function contactReception(subject = 'Olá, preciso de suporte da recepção.'): Promise<void> {
  await openWhatsApp(OLI_RECEPTION_PHONE, subject);
}

/**
 * Notifica paciente sobre o cadastro.
 * LGPD: apenas boas-vindas — nenhum dado de saúde.
 */
export async function notifyPatientCadastro(nome: string, telefone: string): Promise<void> {
  const message = `Olá ${nome}, seu cadastro no OLI Health Hub foi realizado com sucesso. Bem-vindo!`;
  await openWhatsApp(cleanPhone(telefone), message);
}

/**
 * Notifica a recepção sobre novo paciente.
 * LGPD: apenas nome e telefone — sem dados de saúde.
 */
export async function notifyOLINewPatient(nome: string, telefone: string): Promise<void> {
  const message = `Novo paciente cadastrado: ${nome} | Tel: ${telefone}`;
  await openWhatsApp(OLI_RECEPTION_PHONE, message);
}

/**
 * Envia confirmação de consulta ao paciente.
 * LGPD: apenas data, hora e local — sem diagnóstico ou dados de saúde.
 */
export async function notifyPatientAppointment(
  nome: string,
  telefone: string,
  date: Date | string,
  doctorName: string,
): Promise<void> {
  const d = typeof date === 'string' ? new Date(date) : date;
  const message =
    `Olá ${nome}, sua consulta com ${doctorName} está confirmada para ` +
    `${formatDate(d)} às ${formatHour(d)}. ` +
    `OLI Health Hub — qualquer dúvida estamos à disposição!`;
  await openWhatsApp(cleanPhone(telefone), message);
}

/** Abre conversa direta com o paciente */
export async function openPatientChat(nome: string, telefone: string): Promise<void> {
  await openWhatsApp(cleanPhone(telefone), `Olá ${nome}, tudo bem?`);
}
