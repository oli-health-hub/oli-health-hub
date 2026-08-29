/**
 * Edge Function: whatsapp-webhook
 *
 * Recebe mensagens do WhatsApp Business Cloud API (número único da OLI).
 * Número desconhecido (não é paciente cadastrado) vira lead automaticamente
 * e a IA (Claude Haiku) responde e classifica durante a conversa — ver
 * docs/IA_ATENDIMENTO_WHATSAPP.md. Paciente cadastrado nunca recebe IA (só
 * registra e notifica a recepção — ver chk_patient_never_ia no schema).
 *
 * Mesmo padrão de segurança do meta-leads-webhook: handshake GET com
 * hub.challenge, assinatura HMAC do corpo cru, verify_jwt=false (quem chama
 * é o Meta, sem JWT do Supabase).
 *
 * Segredos necessários: WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET (App do
 * Meta dedicado ao WhatsApp — "OLI WPP", diferente do App usado pelo
 * meta-leads-webhook), WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN,
 * ANTHROPIC_API_KEY, OPENAI_API_KEY (transcrição efêmera de áudio de leads).
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { assinaturaConfere, baixarMidiaWhatsApp, enviarTexto, enviarImagem, enviarTemplate } from '../_shared/whatsapp.ts';

// Implementa docs/IA_ATENDIMENTO_WHATSAPP.md — qualquer mudança de
// comportamento passa pelo manual primeiro, este prompt é a aplicação dele.
const SYSTEM_PROMPT_LEAD = `Você é a responsável comercial do OLI Health Hub no WhatsApp — não uma
central de dúvidas, uma vendedora de verdade, boa no que faz. Todo contato
que chega neste número passa primeiro por você, antes de qualquer humano.
Você não sabe de antemão quem está falando: pode ser um profissional de
saúde interessado no espaço, um paciente que errou o número, um parceiro,
ou alguém sem relação nenhuma com o OLI.

ABERTURA DA CONVERSA — só na primeira resposta sua para este contato
(nenhuma mensagem sua ainda no histórico): comece com uma frase curta se
apresentando como Olivia, do OLI Health Hub, e pergunte o nome da pessoa.
Não pergunte mais nada nessa mensagem — nome primeiro, sempre. Da segunda
resposta em diante na mesma conversa, nunca repita a apresentação (vale a
regra de não soar como robô, abaixo). Exemplo: "Olá! Sou a Olivia, do OLI
Health Hub. Como você se chama?"

USO DO NOME: depois que a pessoa disser o nome, use-o para gerar
proximidade — ao cumprimentar ("Prazer, [Nome]!") e depois em
momentos-chave (validar uma objeção, fechamento). Não cite o nome em toda
mensagem — isso também soa robótico.

OBJETIVO, NESTA ORDEM:
1. Entender rapidamente quem é a pessoa e o que ela precisa — sem
   interrogatório, com no máximo uma pergunta aberta por vez.
2. Se for profissional de saúde interessado em atuar no espaço: vender com
   técnica — não recitar fatos, traduzir cada fato no benefício que
   resolve o que ELA disse. Levantar aos poucos (nunca tudo de uma vez)
   nome, especialidade e como conheceu o OLI — informação real, nunca
   inventada, que a equipe usa depois.
3. Se for paciente, ou assunto que não é sobre atuar no OLI (cobrança,
   engano de número, etc.): não tenta resolver, transfere para a equipe.

COMO IDENTIFICAR SEM SER INVASIVA: pergunte de forma natural, no contexto
da conversa — nunca uma lista de perguntas seguidas. Se a pessoa já disse
quem é ou o que quer, não repita a pergunta. Se depois de duas trocas ainda
não houve um sinal claro de que é profissional de saúde interessado, trate
como transferência (abaixo) em vez de insistir.

INTERPRETAÇÃO ANTES DA RESPOSTA — regra central: antes de escrever, identifique
silenciosamente (1) o pedido ou intenção principal da última mensagem, (2) o
que a pessoa já informou no histórico e (3) qual é o próximo passo realmente
útil. Responda a partir dessa leitura; não reaja frase por frase.
• Responda primeiro e diretamente ao que foi perguntado. Só depois faça UMA
  pergunta, e apenas se a resposta mudar de verdade o próximo passo.
• Não repita, parafraseie ou confirme mecanicamente o que a pessoa acabou de
  dizer. Se ela informou especialidade, local, modelo atual ou objetivo, use a
  informação — não a devolva como resumo e não pergunte de novo de outro jeito.
• A mensagem padrão de anúncio "Olá! Posso ter mais informações sobre isso?"
  já indica interesse comercial. Não diga que ela é vaga, curta ou sem
  contexto e não pergunte se a pessoa "chegou por outro motivo". Dê uma visão
  útil em uma frase e pergunte somente a especialidade.
• Se a pessoa corrigir a conversa ("acabei de falar", "foi isso que eu disse"),
  reconheça em uma frase curta, recupere a informação do histórico e avance —
  nunca encerre ou repita a mesma pergunta.
• Não caracterize concorrentes, cidades, custos ou a situação da pessoa sem
  evidência explícita. Nunca use suposições como argumento comercial.
• Sinais de encerramento ("obrigada", "não, tudo bem", "agora não", "não faz
  sentido") recebem no máximo uma despedida curta, sem nova pergunta, oferta,
  resumo ou segunda despedida.

ECONOMIA DE PALAVRAS: normalmente use até 3 blocos curtos e no máximo uma
pergunta. Perguntas simples pedem respostas simples. Evite começar cada turno
com "Entendi", "Ótimo" ou "Perfeito"; não use encerramentos genéricos quando
a conversa ainda tem um assunto concreto. Só listas de preços ou instruções
objetivas podem passar desse tamanho.

COMO VENDER (técnica de vendedor de verdade, não script decorado):
• Descoberta antes de argumento: antes de listar fato, pergunte a situação
  atual da pessoa (atende onde hoje? o que trava ela? o que buscou no
  anúncio?). O benefício só convence quando encaixa no problema real dela.
• Traduza fato em benefício no contexto dela — nunca despeje a lista de
  fatos crua. "Sem mensalidade" vira "você não paga nada parado enquanto
  não estiver atendendo aqui"; "por minuto" vira "você só paga o que usa
  de verdade, sem custo fixo de consultório".
• Quebra de objeção sem contra-atacar: primeiro valide ("faz sentido
  pensar nisso"), depois reenquadre com um fato real. Para custo por
  sessão, use SOMENTE estes dois exemplos já calculados, nunca outro:
  sessão de 50 min no START = R$ 95; sessão de 50 min no PRO = R$ 72,50.
  **Nunca calcule um total novo** (mensal, semanal, por volume de
  pacientes, duração diferente de 50 min) — conta de várias etapas erra
  fácil, e errar um número pra quem vai decidir gastar dinheiro é pior do
  que não responder. Se a pessoa pedir esse tipo de conta, diga que vai
  confirmar o valor certinho com a equipe.
• "Achei caro" → use um dos dois exemplos fixos acima (nunca um número
  novo), e contraste com o CONCEITO de não ter custo fixo nos dias
  parados — NUNCA cite um valor de aluguel de consultório, mercado ou
  concorrente; você não tem esse número, e inventar um é a mesma falha
  que inventar preço de módulo.
• "Vou pensar" → sem pressão, mas sempre oferece o próximo passo natural:
  conhecer o espaço pessoalmente (ver AGENDAMENTO DE VISITA abaixo).
• "Já tenho consultório" → o OLI não compete com isso, é opção extra sem
  custo parado — ela decide quando usar.
• Fechamento suave, sempre que fizer sentido: conduza para a visita, sem
  empurrar — é o próximo passo natural, não uma pressão.
• Nunca soe como robô: nada de "estou aqui para ajudar no que precisar",
  "como posso auxiliar", ou reafirmar que é uma assistente/IA. Escreva
  como alguém do time realmente escrevendo — direto no que a pessoa
  trouxe, sem frase de abertura genérica repetida a cada mensagem (exceto
  a apresentação breve da primeira resposta — ver ABERTURA DA CONVERSA).

PLANOS — fluxo direto após a primeira resposta de contato:
• Se busca atendimentos pontuais, responda: "Para uma rotina mais flexível,
  o START costuma encaixar melhor: sem mensalidade e R$ 1,90 por minuto.
  Você compra horas, reserva a partir de 30 minutos e usa o saldo conforme a
  agenda. Qual é a sua especialidade?"
• Se busca atendimentos recorrentes, responda: "Para uma agenda mais
  recorrente, o PRO pode ser mais adequado: R$ 599/mês, ou R$ 499/mês com
  fidelidade de 6 meses, mais R$ 1,45 por minuto. Inclui emissão de nota
  fiscal e apoio da recepção no agendamento, na cobrança e no retorno dos
  pacientes. Qual é a sua especialidade?"
• Depois de saber a especialidade, diga que há salas preparadas para esse
  atendimento e faça UMA pergunta: prefere receber uma foto ou agendar uma
  visita? Se escolher visita, envie o Calendly. Se escolher foto e demonstrar
  interesse, envie uma foto real pelo META. Não recite ambos os planos se a
  pessoa já informou qual rotina procura.

FATOS QUE VOCÊ PODE AFIRMAR (nada além disso sem confirmar com a equipe):
• O que é o OLI: um hub para profissionais da saúde — reunimos espaço físico
  (salas equipadas, cobradas por minuto de uso, sem aluguel fixo) e um app
  de gestão (agenda, financeiro, cadastro de pacientes) num só lugar, para
  atender sem precisar montar consultório próprio. Fica na Rua Marquês de
  Paranaguá, 348, Edifício Ralph Center, Consolação, São Paulo/SP.
• Estrutura: 9 salas equipadas, atendendo profissionais de diversas
  especialidades (clínica geral, psicologia, ginecologia, estética, entre
  outras).
• Preço, com valor exato: plano START é R$ 1,90 por minuto de sala, sem
  mensalidade. Plano PRO é R$ 599/mês (ou R$ 499/mês no ciclo semestral, com
  fidelidade de 6 meses) mais R$ 1,45 por minuto de sala.
• Modelo de uso: sala cobrada por minuto de uso real, sem aluguel fixo; o
  START não tem fidelidade nenhuma.
• Agendamento de visita: link direto para marcar —
  https://calendly.com/olihealthhub/atendimento-presencial

ÁUDIOS RECEBIDOS: quando a mensagem vier de áudio, você receberá a transcrição
já concluída no contexto. Trate o conteúdo exatamente como trataria uma
mensagem de texto: responda ao que a pessoa disse de forma natural. Nunca diga
que não consegue ouvir, reproduzir ou processar áudio; nunca mencione
transcrição, áudio, ferramenta ou limitação técnica.

O QUE VOCÊ NÃO FAZ:
• Não afirma horário de funcionamento do espaço, não negocia desconto, não
  promete prazo de resposta, e não informa preço de módulo ou qualquer valor
  além dos dois planos acima — nesses casos, diz que vai confirmar com a
  equipe.
• Nunca inventa explicação, política, condição ou detalhe que não foi te
  passado aqui — inclui valor de aluguel de mercado, preço de concorrente,
  ou qualquer número usado só pra comparação que não está nos fatos acima.
  Preencher o vazio com uma suposição plausível é pior do que dizer "vou
  confirmar com a equipe".
• Nunca pede CPF, dado de pagamento ou qualquer dado sensível de saúde pelo
  WhatsApp.
• Não trata paciente, cobrança ou assunto fora do escopo acima como se
  fosse dúvida de profissional interessado — transfere.

AGENDAMENTO DE VISITA — você tem autonomia para isso, não precisa transferir:
quando a pessoa quiser conhecer o espaço, mande o link do Calendly (fato
acima) e diga que ela escolhe o melhor horário por lá. A conversa continua
com você depois disso — não é transferência. Registre um aviso para a equipe
(chave aviso no META, não handoff) com um resumo curto, tipo "enviou link
de agendamento para [nome/especialidade]".

COMO MANDAR FOTO: se a pessoa já disse a especialidade e demonstrou
interesse em ver o espaço, você pode enviar 1 foto real — nunca antes
disso, e nunca mais de 1 por vez. Inclua no META a chave imagem com um
destes valores exatos, nunca outro: psicologia, ginecologia, estetica,
clinica_geral, eventos, estrutura (estrutura = foto geral do espaço, use
se ainda não souber a especialidade mas a pessoa quiser ver algo).

QUANDO ENCERRAR POR ENGANO DE NÚMERO (não é transferência — não envolve
a equipe): este número atende só quem procura o OLI. Se ficar claro que a
pessoa errou o número, procura outro comércio ou serviço, ou está brincando
sem nenhuma intenção real, encerre educadamente em UMA resposta curta —
diga o que é o OLI em uma frase e se despeça. Não faça piada, não puxe
conversa, não pergunte de novo se a pessoa tem interesse, não ofereça
ajuda. Nessa mesma resposta inclua a chave descarte no META (ver abaixo).
Depois disso a conversa se encerra: você não responde mais esse número.
Na dúvida entre engano e alguém que só escreveu pouco, NÃO use descarte —
faça uma pergunta e espere a resposta.

QUANDO TRANSFERIR PARA UM HUMANO (na mesma resposta em que perceber, sem
tentar resolver sozinha primeiro):
• A pessoa pede para falar com alguém, explícita ou implicitamente ("quero
  falar com uma pessoa", "tem atendente?").
• A pessoa é paciente, ou o assunto não é sobre atuar no OLI.
• A dúvida foge do que você pode afirmar (ver acima) ou envolve negociação
  de preço/condição.
• A pessoa reclama, demonstra frustração, ou o tom fica hostil.
• Depois de duas trocas, ainda não ficou claro quem é a pessoa ou o que
  ela quer.

Ao transferir, a resposta visível para a pessoa é só um aviso curto de que
você vai conectá-la com a equipe — NÃO pergunte nome, telefone, e-mail ou
qualquer outro dado "para confirmar" nessa resposta. Isso não é resolver
sozinha, é atrasar a transferência: a equipe já vê o número de quem está
escrevendo e vai perguntar o que precisar diretamente. Se a pessoa já
disse o nome ou a especialidade em qualquer mensagem anterior, inclua no
META (abaixo) nesta mesma resposta, mesmo que já tivesse esquecido de
reportar antes.

COMO REPORTAR PARA A EQUIPE (só quando tiver algo novo a dizer — na maioria
das mensagens não tem nada aqui, e tudo bem não incluir):
Se aprendeu ou confirmou nome, especialidade, ou um resumo de quem é a
pessoa e o que quer, e/ou decidiu transferir ou avisar algo, adicione uma
última linha sozinha no formato:
[META: nome=Nome se souber; especialidade=Especialidade se souber; resumo=frase curta de quem é e o que quer; imagem=chave se for mandar foto; aviso=resumo curto se for um aviso informativo; handoff=motivo se for transferir para humano; descarte=engano se a pessoa errou o número ou não tem relação com o OLI]
Inclua só as chaves com informação nova — pode ser uma só, várias, ou
nenhuma linha. Essa linha nunca é vista pela pessoa, é só para a equipe.
**Toda resposta que decide transferir tem que ter a chave handoff — sem
exceção. handoff, aviso e descarte nunca aparecem juntos — é uma coisa ou
outra. A chave descarte aceita um único valor: engano.**
Exemplo transferência: "[META: nome=Ana Paula; especialidade=Nutrição;
resumo=quer falar com humano, dúvida fora do escopo; handoff=dúvida sobre
convênio, fora do que posso afirmar]". Exemplo agendamento: "[META:
especialidade=Nutrição; imagem=clinica_geral; aviso=enviou link de
agendamento para Ana Paula, nutricionista]". Exemplo engano de número:
"[META: descarte=engano]".

FORMATAÇÃO DO WHATSAPP (importante, é diferente de markdown normal):
• Negrito é *um asterisco de cada lado*, nunca **dois**. Antes de responder,
  revise: se aparecer **, troque por *.
• Sem cabeçalho markdown (#), sem tabela. Listas simples com • ou -.

Responda sempre em português formal, sem gírias ou contrações informais
("pra", "tá" etc.) — antes de enviar, revise sua própria resposta: se
aparecer "pra", troque por "para"; se aparecer "tá", troque por "está".
De forma acolhedora e objetiva, em mensagens curtas — está no WhatsApp,
não escreva parágrafos longos.`;

type ConversaRow = {
  id: string; kind: string; status: string; phone_e164: string;
  patient_id: string | null; lead_id: string | null; professional_id: string | null;
};

/** Acha o registro existente pelo telefone; senão tenta casar com paciente
 *  cadastrado. Se não for paciente e não houver lead com esse telefone,
 *  cria um lead automaticamente (origem='whatsapp') — todo contato é
 *  atendido e classificado, nunca cai em "não classificada" sem resposta
 *  (ver docs/IA_ATENDIMENTO_WHATSAPP.md §1). A IA aprende quem é a pessoa
 *  durante a conversa e preenche o cadastro via a tag [META: ...]. */
async function resolveConversa(supabase: SupabaseClient, phone: string): Promise<ConversaRow> {
  const { data: existente } = await supabase.from('conversations').select('*').eq('phone_e164', phone).maybeSingle();
  if (existente) return existente as ConversaRow;

  const ultimos10 = phone.slice(-10);

  const { data: patient } = await supabase
    .from('patients').select('id, professional_id')
    .ilike('telefone', `%${ultimos10}`)
    .maybeSingle();
  if (patient) {
    const { data: criada } = await supabase.from('conversations').insert({
      kind: 'patient', patient_id: patient.id, professional_id: patient.professional_id,
      phone_e164: phone, status: 'humano',
    }).select().single();
    return criada as ConversaRow;
  }

  const { data: leadExistente } = await supabase
    .from('leads').select('id')
    .ilike('whatsapp', `%${ultimos10}`)
    .maybeSingle();

  let leadId = leadExistente?.id ?? null;
  if (!leadId) {
    const { data: novoLead } = await supabase.from('leads').insert({
      nome: 'Contato via WhatsApp', whatsapp: phone, origem: 'whatsapp', status: 'novo',
    }).select('id').single();
    leadId = novoLead?.id ?? null;
  }

  const { data: criada } = await supabase.from('conversations').insert({
    kind: 'lead', lead_id: leadId, phone_e164: phone, status: 'ia',
  }).select().single();
  return criada as ConversaRow;
}

type MetaTag = {
  nome?: string; especialidade?: string; resumo?: string;
  imagem?: string; aviso?: string; handoff?: string; descarte?: string;
};

const CHAVES_META = ['nome', 'especialidade', 'resumo', 'imagem', 'aviso', 'handoff', 'descarte'] as const;

/** Fotos reais e públicas (mesmas do site) por especialidade — chave fechada
 *  de propósito, a IA nunca inventa URL. Mapa sala→especialidade confirmado
 *  em produção via `select id, specialties from rooms` (24/ago). */
const FOTO_POR_ESPECIALIDADE: Record<string, string> = {
  psicologia:     'https://olihealthhub.com.br/fotos/sala-psicologia.jpg',
  ginecologia:    'https://olihealthhub.com.br/fotos/consultorio-ginecologia.jpg',
  estetica:       'https://olihealthhub.com.br/fotos/consultorio-ginecologia.jpg',
  clinica_geral:  'https://olihealthhub.com.br/fotos/atendimento-mesa.jpg',
  eventos:        'https://olihealthhub.com.br/fotos/sala-eventos.jpg',
  estrutura:      'https://olihealthhub.com.br/fotos/lounge.jpg',
};

/** Extrai a tag técnica opcional "[META: chave=valor; ...]" do fim da
 *  resposta da IA (nunca mostrada à pessoa) — ver docs/IA_ATENDIMENTO_WHATSAPP.md §6. */
function extraiMeta(reply: string): { texto: string; meta: MetaTag | null } {
  const m = reply.match(/\[META:\s*([^\]]*)\]\s*$/i);
  if (!m) return { texto: reply.trim(), meta: null };

  const meta: MetaTag = {};
  for (const par of m[1].split(';')) {
    const idx = par.indexOf('=');
    if (idx < 0) continue;
    const chave = par.slice(0, idx).trim().toLowerCase();
    const valor = par.slice(idx + 1).trim();
    if (!valor) continue;
    if ((CHAVES_META as readonly string[]).includes(chave)) {
      (meta as Record<string, string>)[chave] = valor;
    }
  }
  return { texto: reply.slice(0, m.index).trim(), meta };
}

async function transcreverAudio(audioId: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY ausente — transcrição de áudio não configurada');

  const { arquivo, mimeType } = await baixarMidiaWhatsApp(audioId);
  const extensao = mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('mpeg') ? 'mp3'
    : mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('wav') ? 'wav'
    : 'webm';
  const form = new FormData();
  form.append('file', arquivo, `audio.${extensao}`);
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('language', 'pt');
  form.append('prompt', 'Transcrição em português do Brasil. Contexto: atendimento comercial do OLI Health Hub.');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form,
  });
  const data = await response.json() as { text?: string; error?: { message?: string } };
  if (!response.ok || !data.text?.trim()) {
    throw new Error(`Falha na transcrição: ${data.error?.message ?? response.status}`);
  }
  return data.text.trim();
}

async function responderComIA(supabase: SupabaseClient, conv: ConversaRow, mensagemAtual?: string) {
  const { data: historico } = await supabase
    .from('messages')
    .select('direction, body')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
    .limit(40);

  const mensagens = (historico ?? [])
    .filter(m => m.body && !m.body.startsWith('[Áudio recebido'))
    .map(m => ({ role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const, content: m.body as string }));

  if (mensagemAtual) mensagens.push({ role: 'user', content: mensagemAtual });

  if (mensagens.length === 0) return;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT_LEAD,
    messages: mensagens,
  });

  const bruto = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const { texto: reply, meta } = extraiMeta(bruto);
  if (!reply) return;

  const { wamid } = await enviarTexto({ to: conv.phone_e164, body: reply });

  await supabase.from('messages').insert({
    conversation_id: conv.id, direction: 'outbound', sender_type: 'ia',
    body: reply, wamid, status: 'enviada',
  });

  if (meta?.descarte === 'engano') {
    // Engano de número: encerra a conversa (status 'fechada' faz a IA parar
    // de responder este número) e tira o lead do funil. O registro não é
    // apagado — fica descartado com motivo, para não sumir do histórico nem
    // contaminar a taxa de conversão. Não notifica ninguém: não há nada
    // para a equipe fazer com um engano.
    await supabase.from('conversations').update({ status: 'fechada' }).eq('id', conv.id);
    if (conv.lead_id) {
      await supabase.from('leads')
        .update({ status: 'descartado', motivo_descarte: 'engano_numero' })
        .eq('id', conv.lead_id);
    }
    return;
  }

  if (conv.lead_id && (meta?.nome || meta?.especialidade || meta?.resumo)) {
    const campos: Record<string, string> = {};
    if (meta.nome && meta.nome.length >= 2) campos.nome = meta.nome.slice(0, 120);
    if (meta.especialidade) campos.especialidade = meta.especialidade.slice(0, 120);
    if (meta.resumo) campos.observacoes = meta.resumo.slice(0, 2000);
    if (Object.keys(campos).length > 0) {
      await supabase.from('leads').update(campos).eq('id', conv.lead_id);
    }
  }

  const urlFoto = meta?.imagem ? FOTO_POR_ESPECIALIDADE[meta.imagem] : undefined;
  if (urlFoto) {
    try {
      const { wamid: wamidFoto } = await enviarImagem({ to: conv.phone_e164, link: urlFoto });
      await supabase.from('messages').insert({
        conversation_id: conv.id, direction: 'outbound', sender_type: 'ia',
        body: `[imagem: ${meta!.imagem}]`, wamid: wamidFoto, status: 'enviada',
      });
    } catch (err) {
      // Falha no envio da foto não deve derrubar o resto do turno.
      console.error('[whatsapp-webhook] falha ao enviar imagem:', err);
    }
  }

  if (meta?.handoff) {
    await supabase.from('conversations').update({ status: 'humano' }).eq('id', conv.id);
    await supabase.from('admin_notifications').insert({
      type: 'whatsapp_message_received',
      title: 'Lead pediu atendimento humano no WhatsApp',
      body: meta.handoff,
      metadata: { conversation_id: conv.id, kind: 'lead' },
    });

    const commercialPhone = Deno.env.get('WHATSAPP_COMMERCIAL_PHONE');
    const handoffTemplate = Deno.env.get('WHATSAPP_HANDOFF_TEMPLATE_NAME');
    if (!commercialPhone || !handoffTemplate) {
      console.warn('[whatsapp-webhook] alerta comercial não configurado — faltam WHATSAPP_COMMERCIAL_PHONE ou WHATSAPP_HANDOFF_TEMPLATE_NAME');
    } else {
      try {
        await enviarTemplate({
          to: commercialPhone,
          templateName: handoffTemplate,
          idioma: 'pt_BR',
          variaveis: [
            conv.phone_e164,
            meta.nome ?? 'Não informado',
            meta.resumo ?? 'Sem resumo adicional',
            meta.handoff,
          ],
        });
      } catch (err) {
        // O alerta complementar não pode impedir a transferência para a equipe.
        console.error('[whatsapp-webhook] falha ao enviar alerta comercial:', err);
      }
    }
  } else if (meta?.aviso) {
    // Aviso informativo — não tira a IA da conversa, só avisa a recepção.
    await supabase.from('admin_notifications').insert({
      type: 'whatsapp_message_received',
      title: 'Aviso da IA no WhatsApp',
      body: meta.aviso,
      metadata: { conversation_id: conv.id, kind: 'lead' },
    });
  }
}

/** Janela curta de agrupamento de mensagens.
 *
 *  Quem manda "Oi" e logo em seguida "Boa tarde" gera um POST do Meta por
 *  mensagem, e cada execução respondia por conta própria, sem saber da
 *  outra — a pessoa recebia duas saudações seguidas, ligeiramente
 *  diferentes, o que denuncia robô logo no primeiro contato.
 *
 *  Cada execução espera esta janela e só responde se a sua mensagem ainda
 *  for a última recebida na conversa: a execução mais recente responde por
 *  todas, já com o histórico completo no banco. Não precisa de lock — o
 *  próprio banco é o desempate.
 *
 *  A espera aumenta o tempo de resposta ao Meta; reentrega do webhook por
 *  timeout continua protegida pela unicidade de `wamid` (23505 abaixo). */
const JANELA_AGRUPAMENTO_MS = 5000;

/** Depois da janela: a mensagem ainda é a última, e a conversa continua com
 *  a IA? (a execução vizinha pode ter transferido ou encerrado no meio). */
async function aindaCabeResponder(
  supabase: SupabaseClient, conv: ConversaRow, wamid: string,
): Promise<boolean> {
  const { data: ultima } = await supabase
    .from('messages')
    .select('wamid')
    .eq('conversation_id', conv.id)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima?.wamid && ultima.wamid !== wamid) return false;

  const { data: atual } = await supabase
    .from('conversations').select('status').eq('id', conv.id).maybeSingle();
  return atual?.status === 'ia';
}

async function processarMensagem(
  supabase: SupabaseClient,
  msg: {
    id: string; from: string; type: string; text?: { body: string }; audio?: { id: string };
    button?: { text: string; payload: string };
    interactive?: { type: string; button_reply?: { title: string }; list_reply?: { title: string } };
  },
) {
  const conv = await resolveConversa(supabase, msg.from);
  // Botão de resposta rápida do template (quick reply, ex.: "Quero conhecer")
  // chega como type='button'; botão de mensagem interativa livre chega como
  // type='interactive'. Os dois têm que virar texto normal pra Olivia
  // enxergar — sem isso a mensagem caía em "não suportada" e nunca gerava
  // resposta, mesmo com todo template tendo botão associado.
  const textoBotao = msg.button?.text ?? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title;
  let body = msg.type === 'text' ? (msg.text?.body ?? '')
    : textoBotao ? textoBotao
    : `[mensagem tipo ${msg.type} não suportada ainda]`;
  let mensagemAtual: string | undefined;
  let audioTranscrito = false;

  if (msg.type === 'audio' && msg.audio?.id && conv.kind === 'lead' && conv.status === 'ia') {
    try {
      const transcricao = await transcreverAudio(msg.audio.id);
      body = '[Áudio recebido — conteúdo não retido]';
      mensagemAtual = `O cliente enviou este áudio. Use a transcrição apenas para responder a esta mensagem, sem citá-la: ${transcricao}`;
      audioTranscrito = true;
    } catch (err) {
      body = '[Áudio recebido — não foi possível processar automaticamente]';
      console.error('[whatsapp-webhook] falha na transcrição de áudio:', err);
    }
  }
  const senderType = conv.kind === 'lead' ? 'lead' : conv.kind === 'patient' ? 'patient' : 'unknown';

  const { error: insertErr } = await supabase.from('messages').insert({
    conversation_id: conv.id, direction: 'inbound', sender_type: senderType,
    body, wamid: msg.id, status: 'entregue',
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      console.log(`[whatsapp-webhook] wamid ${msg.id} duplicado — reenvio do Meta, ignorando`);
      return;
    }
    throw new Error(insertErr.message);
  }

  // Qualquer resposta do lead cancela a régua de nutrição comercial pendente
  // (docs/WHATSAPP_NUTRICAO_COMERCIAL.md) — a partir daqui a conversa segue
  // pelo caminho normal (IA ou humano), não pela agenda de disparo.
  if (conv.kind === 'lead' && conv.lead_id) {
    await supabase.from('whatsapp_nutricao_etapas')
      .update({ status: 'cancelada', erro: 'lead respondeu' })
      .eq('lead_id', conv.lead_id)
      .eq('status', 'agendada');
  }

  const iaResponde = conv.kind === 'lead' && conv.status === 'ia' && (msg.type === 'text' || !!textoBotao || audioTranscrito);
  if (iaResponde) {
    await new Promise(resolve => setTimeout(resolve, JANELA_AGRUPAMENTO_MS));
    if (!await aindaCabeResponder(supabase, conv, msg.id)) {
      console.log(`[whatsapp-webhook] ${msg.id} agrupada — outra execução responde por esta conversa`);
      return;
    }
    try {
      await responderComIA(supabase, conv, mensagemAtual);
      return;
    } catch (err) {
      // Falha na IA não deve perder a mensagem — cai pra notificação humana.
      console.error('[whatsapp-webhook] falha ao gerar resposta de IA:', err);
    }
  }

  await supabase.from('admin_notifications').insert({
    type: 'whatsapp_message_received',
    professional_id: conv.professional_id,
    title: conv.kind === 'patient' ? 'Nova mensagem de paciente no WhatsApp' : 'Nova mensagem no WhatsApp',
    body: body.slice(0, 140),
    metadata: { conversation_id: conv.id, kind: conv.kind },
  });
}

async function processarStatus(supabase: SupabaseClient, status: { id: string; status: string }) {
  const mapa: Record<string, string> = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' };
  const novo = mapa[status.status];
  if (!novo) return;
  await supabase.from('messages').update({ status: novo }).eq('wamid', status.id);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const modo      = url.searchParams.get('hub.mode');
    const token     = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (modo === 'subscribe' && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN') && challenge) {
      console.log('[whatsapp-webhook] handshake verificado');
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    console.warn('[whatsapp-webhook] handshake recusado — verify_token não confere');
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!appSecret) {
    console.error('[whatsapp-webhook] WHATSAPP_APP_SECRET ausente — recusando tudo');
    return new Response('Server misconfigured', { status: 500 });
  }

  const corpoCru = await req.text();
  if (!await assinaturaConfere(corpoCru, req.headers.get('x-hub-signature-256'), appSecret)) {
    console.warn('[whatsapp-webhook] assinatura inválida');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: {
    entry?: Array<{ changes?: Array<{ field?: string; value?: {
      messages?: Array<{
        id: string; from: string; type: string; text?: { body: string }; audio?: { id: string };
        button?: { text: string; payload: string };
        interactive?: { type: string; button_reply?: { title: string }; list_reply?: { title: string } };
      }>;
      statuses?: Array<{ id: string; status: string }>;
    } }> }>;
  };
  try {
    payload = JSON.parse(corpoCru);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const changes = (payload.entry ?? []).flatMap(e => e.changes ?? []).filter(c => c.field === 'messages');
  if (changes.length === 0) {
    return new Response('ok', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let houveFalhaTransitoria = false;

  for (const change of changes) {
    for (const msg of change.value?.messages ?? []) {
      try {
        await processarMensagem(supabase, msg);
      } catch (err) {
        console.error(`[whatsapp-webhook] erro ao processar mensagem ${msg.id}:`, err);
        houveFalhaTransitoria = true;
      }
    }
    for (const status of change.value?.statuses ?? []) {
      await processarStatus(supabase, status).catch(err =>
        console.error(`[whatsapp-webhook] erro ao processar status ${status.id}:`, err));
    }
  }

  if (houveFalhaTransitoria) {
    return new Response('Retry', { status: 500 });
  }
  return new Response('ok', { status: 200 });
});
