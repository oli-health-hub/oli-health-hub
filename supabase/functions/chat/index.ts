import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Escopo e regras do assistente geral ──────────────────────────────────────

const SYSTEM_PROMPT = `Você é Olivia, assistente virtual do OLI Health Hub — um coworking médico
físico com app de gestão para os profissionais que utilizam o espaço.

ESCOPO — você responde sobre o funcionamento do espaço e do app OLI:
• Salas disponíveis, tipos de espaço e equipamentos
• Planos disponíveis (START e PRO) e o que cada um inclui
• Processo de reserva de salas, encaixe e regras de uso
• Módulos e soluções (Communicare, Contabilidade Médica, Scribe IA, etc.)
• Eventos OLI: calendário e participação
• Comunidade OLI: como funciona, como conectar com outros membros
• Programa de Indicação
• Dúvidas de uso do aplicativo

FORA DO SEU ESCOPO — não tente responder questões jurídicas, contábeis, de
credenciamento em convênios ou de carreira médica. Para esses temas, oriente
o profissional a buscar assessoria especializada por conta própria ou a
falar com a recepção do OLI pelo WhatsApp.

Responda sempre em português formal, sem gírias ou contrações informais
("pra", "tá" etc.), de forma acolhedora e objetiva. Prefira tópicos a
parágrafos longos.`;

const client = new Anthropic();

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[];
    };

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('chat edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
