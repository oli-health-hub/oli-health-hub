import { Linking } from 'react-native';
import { formatDate, formatHour } from './formatters';

// Lido do ambiente de build — definido em .env (nunca hardcoded)
// EXPO_PUBLIC_* são injetadas pelo Metro no bundle do cliente
const OLI_RECEPTION_PHONE =
  process.env.EXPO_PUBLIC_OLI_RECEPTION_PHONE ?? '5511919980777';

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

async function openWhatsApp(phone: string, message: string): Promise<boolean> {
  // wa.me funciona em Expo Go, builds e web — não depende do scheme whatsapp://
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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

/**
 * Solicita consentimento LGPD ao paciente via WhatsApp com link único.
 * O paciente acessa a página, lê os termos e clica "Autorizo".
 * O aceite é gravado no Supabase com timestamp e IP — prova jurídica LGPD Art. 7.
 */
export async function notifyPatientLGPDConsent(
  nome:        string,
  telefone:    string,
  doctorName:  string,
  consentToken: string,
): Promise<void> {
  const link = `https://olihealthhub.com.br/consentimento?token=${consentToken}`;
  const message =
    `Olá ${nome}! 👋\n\n` +
    `Dr(a). ${doctorName} realizou seu cadastro no *OLI Health Hub* para facilitar seus agendamentos.\n\n` +
    `Precisamos da sua autorização para armazenar seus dados, conforme a *LGPD (Lei 13.709/2018)*.\n\n` +
    `👉 Acesse o link abaixo, leia os termos e autorize em 1 toque:\n` +
    `${link}\n\n` +
    `_Este link é exclusivo para você e expira após o uso._`;
  await openWhatsApp(cleanPhone(telefone), message);
}

/**
 * Envia confirmação de encaixe ao paciente com todos os detalhes do horário.
 * LGPD: apenas logística — sem diagnóstico ou dados de saúde.
 */
export async function notifyPatientEncaixe(
  nome:       string,
  telefone:   string,
  doctorName: string,
  dateStr:    string,
  timeStr:    string,
  durLabel:   string,
  roomName?:  string,
): Promise<void> {
  const salaInfo = roomName ? `\n📍 Sala: ${roomName}` : '';
  const message =
    `Olá ${nome}! 🗓️\n\n` +
    `Dr(a). ${doctorName} confirmou um horário especial para você:\n\n` +
    `📅 *${dateStr}*\n` +
    `🕐 *${timeStr}* (${durLabel})` +
    `${salaInfo}\n\n` +
    `📍 OLI Health Hub\n\n` +
    `Em caso de dúvidas ou necessidade de reagendamento, entre em contato com a nossa recepção. Até lá! 🌿`;
  await openWhatsApp(cleanPhone(telefone), message);
}

/** Abre conversa direta com o paciente */
export async function openPatientChat(nome: string, telefone: string): Promise<void> {
  await openWhatsApp(cleanPhone(telefone), `Olá ${nome}, tudo bem?`);
}

/**
 * Solicita pacote de horas pré-pago para a recepção do OLI.
 * Abre WhatsApp com mensagem pré-preenchida para a recepção processar.
 */
export async function requestHourPackage(
  doctorName: string,
  hours:       number,
  price:       number,
): Promise<void> {
  const valorStr = price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const message =
    `📦 *Solicitação de Pacote de Horas*\n\n` +
    `Médico: ${doctorName}\n` +
    `Pacote: ${hours} horas\n` +
    `Valor: ${valorStr}\n\n` +
    `Por favor, confirme a disponibilidade e envie o link de pagamento. Obrigado!`;
  await openWhatsApp(OLI_RECEPTION_PHONE, message);
}
