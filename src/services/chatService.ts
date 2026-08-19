import { supabase } from './supabase';

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role:    ChatRole;
  content: string;
}

export async function sendChatMessage(
  history:  ChatTurn[],
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { messages: history },
  });

  if (error) throw new Error(error.message ?? 'Erro ao chamar o assistente');

  const reply = data?.reply;
  if (typeof reply !== 'string' || !reply) {
    throw new Error('Resposta inválida do assistente');
  }

  return reply;
}
