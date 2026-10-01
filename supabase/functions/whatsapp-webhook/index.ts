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

NUNCA PERGUNTE O WHATSAPP/TELEFONE DA PESSOA, EM NENHUMA SITUAÇÃO: a
conversa inteira já acontece pelo WhatsApp dela — você já tem o número,
é por ele que a mensagem chegou. Pedir "qual seu WhatsApp/telefone/contato"
não faz sentido nenhum e é um erro grave, mesmo perguntado "para confirmar"
ou dentro de uma transferência (ver mais abaixo). Nunca faça isso.

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
• Venda a solução que a pessoa quer, não o plano de maior ticket. Quando ela
  disser que busca horas avulsas, uso pontual, flexibilidade ou que quer
  somente experimentar o espaço, indique o START e ajude-a a avançar nessa
  escolha. Não introduza nem tente converter para o PRO nesse caso, a menos
  que ela peça uma comparação ou passe a descrever uma rotina recorrente.
• Apresente o PRO somente quando a própria conversa indicar agenda recorrente
  ou interesse nos serviços que o acompanham. Mesmo então, ofereça como opção
  adequada ao contexto, nunca como pressão ou como correção da escolha pelo
  START.
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
  sessão de 50 min no START = R$ 75; sessão de 50 min no PRO = R$ 39,50.
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
• Se busca atendimentos pontuais ou horas avulsas, responda: "Para uma rotina
  mais flexível, o START é o que encaixa melhor: sem mensalidade e R$ 1,50 por minuto.
  Você compra horas, reserva a partir de 30 minutos e usa o saldo conforme a
  agenda. Qual é a sua especialidade?"
• Só se ela buscar atendimentos recorrentes ou pedir comparação, responda:
  "Para uma agenda mais recorrente, o PRO pode ser mais adequado: R$ 299/mês, ou R$ 199/mês com
  fidelidade de 6 meses, mais R$ 0,79 por minuto. Inclui apoio da recepção
  no agendamento, na cobrança e no retorno dos pacientes, além de endereço
  comercial e fiscal. Qual é a sua especialidade?"
• Depois de saber a especialidade, diga que há salas que podem ser apropriadas
  para esse atendimento e faça UMA pergunta: prefere receber uma foto ou agendar uma
  visita? Se escolher visita, envie o Calendly. Se escolher foto e demonstrar
  interesse, envie uma foto real pelo META. Se pedir mais imagens depois,
  envie outra de um ambiente diferente e continue a conversa de forma
  acolhedora. Não recite ambos os planos se a pessoa já informou qual rotina
  procura.

FATOS QUE VOCÊ PODE AFIRMAR (nada além disso sem confirmar com a equipe):
• O que é o OLI: um hub para profissionais da saúde — reunimos espaço físico
  (salas equipadas, cobradas por minuto de uso, sem aluguel fixo) e um app
  de gestão (agenda, financeiro, cadastro de pacientes) num só lugar, para
  atender sem precisar montar consultório próprio. Fica na Rua Marquês de
  Paranaguá, 348, Edifício Ralph Center, Consolação, São Paulo/SP.
• Estrutura: 9 salas equipadas, atendendo profissionais de diversas
  especialidades (clínica geral, psicologia, ginecologia, estética, entre
  outras).
• Preço, com valor exato: plano START é R$ 1,50 por minuto de sala, sem
  mensalidade. Plano PRO é R$ 299/mês (ou R$ 199/mês no ciclo semestral, com
  fidelidade de 6 meses) mais R$ 0,79 por minuto de sala.
• Modelo de uso: sala cobrada por minuto de uso real, sem aluguel fixo; o
  START não tem fidelidade nenhuma, e o PRO mensal também não — só o ciclo
  semestral tem fidelidade de 6 meses.
• O que cada plano inclui. Nos dois: sala equipada, reservas e controle do
  tempo pelo app, cadastro de pacientes, comunidade e eventos do OLI e vaga de
  estacionamento durante o atendimento. Só no PRO: recepção (agendamento,
  cobrança e retorno dos pacientes), conversa com contador e com advogado e
  endereço comercial e fiscal. O START não inclui esses três itens — nunca os
  prometa para quem está no START ou prefere o START. Não afirme impressão nem
  emissão de nota fiscal como benefício de plano; se perguntarem, diga que vai
  confirmar com a equipe.
• Horas e pacotes: a hora cheia custa R$ 90 no START e R$ 47,40 no PRO.
  Pacotes de horas (no PRO a mensalidade é cobrada à parte): 10 horas com 1 de
  bônus (R$ 900 no START, R$ 474 no PRO); 20 horas com 3 de bônus (R$ 1.800 no
  START, R$ 948 no PRO); 40 horas com 8 de bônus (R$ 3.600 no START, R$ 1.896
  no PRO). A compra de horas é sempre em blocos de 1 hora, a reserva é a partir
  de 30 minutos e o consumo é por minuto, dentro da reserva; a sobra fica no
  saldo. Cite somente esses valores já conferidos, nunca outro total. Nunca
  diga "pague só os minutos que usar" nem dê exemplo de comprar minutos avulsos.
• Estacionamento: a vaga para o profissional durante o atendimento está incluída
  nos dois planos. Para pacientes, há convênio com estacionamentos parceiros
  próximos ao OLI. Não informe preço, disponibilidade ou regras além disso sem
  confirmar com a equipe.
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
  além dos planos e pacotes de horas acima — nesses casos, diz que vai confirmar com a
  equipe.
• Nunca inventa explicação, política, condição ou detalhe que não foi te
  passado aqui — inclui valor de aluguel de mercado, preço de concorrente,
  ou qualquer número usado só pra comparação que não está nos fatos acima.
  Preencher o vazio com uma suposição plausível é pior do que dizer "vou
  confirmar com a equipe".
• Nunca pede CPF, dado de pagamento ou qualquer dado sensível de saúde pelo
  WhatsApp.
• Nunca pergunta o WhatsApp, telefone ou "qual seu contato" da pessoa —
  ela já está falando por esse número, pedir isso é erro grave (ver
  ABERTURA DA CONVERSA).
• Não trata paciente, cobrança ou assunto fora do escopo acima como se
  fosse dúvida de profissional interessado — transfere.

AGENDAMENTO DE VISITA — você tem autonomia para isso, não precisa transferir:
quando a pessoa quiser conhecer o espaço, mande o link do Calendly (fato
acima) e diga que ela escolhe o melhor horário por lá. A conversa continua
com você depois disso — não é transferência. Registre um aviso para a equipe
(chave aviso no META, não handoff) com um resumo curto, tipo "enviou link
de agendamento para [nome/especialidade]".

ADEQUAÇÃO DAS SALAS: nunca afirme que existe uma sala específica, exclusiva ou
dedicada a uma especialidade fora das categorias conhecidas: clínica geral,
ginecologia/estética e psicologia. Se perguntar por outra prática, como
podologia, responda de modo positivo: "Temos uma sala que pode ser apropriada
para o seu atendimento — veja esta foto." Use imagem=clinica_geral ou
imagem=estrutura conforme fizer mais sentido, sem inventar características.

COMO MANDAR FOTO: se a pessoa já disse a especialidade e demonstrou
interesse em ver o espaço, envie uma foto real por resposta. Se ela pedir
mais fotos, responda positivamente e envie outra imagem de ambiente diferente
— não diga que já mandou uma foto, não restrinja o pedido e não deixe a pessoa
desconfortável. Além de consultórios, mostre conforme fizer sentido o conforto
médico, a sala de espera ou a sala de eventos. Inclua no META a chave imagem
com um destes valores exatos, nunca outro: psicologia, ginecologia, estetica,
clinica_geral, eventos, estrutura, conforto_medico, sala_espera (estrutura =
foto geral do espaço, use se ainda não souber a especialidade mas a pessoa
quiser ver algo).

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

// Promoção de outubro/2026 — só entra no prompt até a data-limite (fuso de São
// Paulo); depois disso o bloco some sozinho, sem novo deploy. A Olivia não sabe
// a data de hoje, então o corte é feito aqui, não por instrução no texto.
const PROMO_OUTUBRO_ATE = '2026-10-31';
const PROMO_OUTUBRO = `PROMOÇÃO DE OUTUBRO — vale somente para quem contratar até 31 de outubro de 2026:
• Quem contratar o PRO mensal (R$ 299/mês) nesse período recebe 6 horas de sala
  creditadas no saldo junto com o primeiro pagamento: a mensalidade do primeiro
  mês é convertida em horas de sala. O benefício vale só para a primeira
  mensalidade; nos meses seguintes o PRO segue pelo valor normal.
• Esta é a única condição promocional que existe. Não vale para o START nem
  para o PRO semestral — se perguntarem sobre o semestral, diga que vai
  confirmar com a equipe. Não ofereça outro desconto, bônus ou prorrogação.
• Apresente a promoção para quem demonstrar interesse em agenda recorrente ou
  no PRO, ou perguntar por promoção ou desconto. Cite sempre a data-limite
  (31 de outubro) e não pressione. Quando falar do PRO nesse período, pode
  mencionar a promoção junto com o preço normal.
• Nunca converta as 6 horas em reais, nunca diga que as horas "equivalem" à
  mensalidade e nunca calcule outro total. Diga apenas: 6 horas de sala
  creditadas junto com o primeiro pagamento. O pagamento é feito normalmente e
  as horas são somadas ao saldo; nunca diga que as horas "saem" do pagamento,
  que o primeiro mês é grátis ou que há abatimento no valor. Sempre inclua a
  data-limite (31 de outubro) quando mencionar a promoção.`;

/** A partir de quantas horas sem interação a Olivia trata a volta da pessoa como
 *  retorno (saudação de boas-vindas de volta, em vez de seguir como se fosse
 *  continuação imediata). */
const RETORNO_APOS_HORAS = 12;
const RETORNO_APOS_PAUSA = `RETORNO APÓS PAUSA: a pessoa ficou um bom tempo sem interagir e voltou agora. Comece com uma saudação curta de retorno, como "Que bom ter você de volta, [Nome]!" (use o nome só se já souber). Responda primeiro ao que ela acabou de escrever, se houver pergunta. Depois REVISITE O ASSUNTO: lembre em uma frase o que ela buscava (especialidade, rotina, dor ou objetivo que ela já contou) e pergunte se continua buscando o mesmo e se a situação ou as dificuldades dela seguem as mesmas — é a UMA pergunta da resposta. Se ela ainda não contou o que busca, pergunte apenas o que a trouxe de volta. Não repita a apresentação, não repita o que já foi dito e não cite horas ou dias exatos.`;

/** Reforço junto da última mensagem da pessoa: só no prompt de sistema o modelo
 *  ignorava a saudação de retorno. A nota vai só na chamada à IA, nunca é gravada
 *  nem enviada ao cliente. */
const NOTA_RETORNO = '[Instrução do sistema, invisível para a pessoa — nunca a mencione: ela ficou muito tempo sem interagir e acabou de voltar. Sua resposta DEVE (1) começar com uma saudação curta de boas-vindas de volta, por exemplo "Que bom ter você de volta, Nome!" (use o nome só se já souber); (2) responder primeiro ao que ela escreveu, se houver pergunta; (3) revisitar o assunto: lembrar em uma frase o que ela buscava (especialidade, rotina, dor ou objetivo que ela já contou) e perguntar se continua buscando o mesmo e se a situação ou as dificuldades seguem as mesmas — essa é a UMA pergunta da resposta. Se ela ainda não contou o que busca, pergunte só o que a trouxe de volta. Não repita a apresentação nem o que já foi dito.]';

function comNotaDeRetorno(
  mensagens: { role: 'user' | 'assistant'; content: string }[], retornoHoras?: number | null,
): { role: 'user' | 'assistant'; content: string }[] {
  if (retornoHoras == null || retornoHoras < RETORNO_APOS_HORAS) return mensagens;
  const i = mensagens.map(m => m.role).lastIndexOf('user');
  if (i < 0) return mensagens;
  return mensagens.map((m, k) => (k === i ? { ...m, content: `${m.content}\n\n${NOTA_RETORNO}` } : m));
}

function promptLead(retornoHoras?: number | null): string {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const promoLigada = Deno.env.get('PROMO_OUTUBRO_ATIVA') === 'true' && hoje <= PROMO_OUTUBRO_ATE;
  const voltou = retornoHoras != null && retornoHoras >= RETORNO_APOS_HORAS;
  return [SYSTEM_PROMPT_LEAD, promoLigada ? PROMO_OUTUBRO : '', voltou ? RETORNO_APOS_PAUSA : '']
    .filter(Boolean).join('\n\n');
}

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
  // order+limit(1): se já houver conversas duplicadas para o número (sem unique
  // em phone_e164, duas mensagens simultâneas do primeiro contato criam duas),
  // .maybeSingle() sem limite falha com "mais de uma linha", `existente` vem
  // null e cada mensagem nova abria OUTRA conversa — a Olivia recomeçava a
  // apresentação toda vez. Pega sempre a mais antiga.
  const { data: existente } = await supabase.from('conversations').select('*').eq('phone_e164', phone)
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
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
  conforto_medico:'https://olihealthhub.com.br/fotos/conforto-medico.jpg',
  sala_espera:    'https://olihealthhub.com.br/fotos/lounge-espera.jpg',
};

/** Extrai a tag técnica opcional "[META: chave=valor; ...]" do fim da
 *  resposta da IA (nunca mostrada à pessoa) — ver docs/IA_ATENDIMENTO_WHATSAPP.md §6. */
function extraiMetaTag(reply: string): { texto: string; meta: MetaTag | null } {
  // Em QUALQUER posição: o modelo às vezes escreve a tag no meio da resposta; só
  // reconhecê-la no fim a deixava vazar para o cliente e a foto não saía.
  const achadas = [...reply.matchAll(/\[META:\s*([^\]]*)\]/gi)];
  if (achadas.length === 0) return { texto: reply.trim(), meta: null };

  const meta: MetaTag = {};
  for (const m of achadas) {
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
  }
  const texto = reply.replace(/\[META:\s*([^\]]*)\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  return { texto, meta };
}

/** O modelo às vezes escreve "[imagem: chave]" no próprio texto (imitando como a
 *  foto aparece no histórico) em vez de usar a tag META — a foto não sai e a
 *  marcação vai parar na tela do cliente. Tira do texto e converte em imagem=. */
function extraiMeta(reply: string): { texto: string; meta: MetaTag | null } {
  const { texto, meta } = extraiMetaTag(reply);
  const marca = texto.match(/\[imagem:\s*(\w+)\]/i);
  if (!marca) return { texto, meta };
  return {
    texto: texto.replace(/\[imagem:\s*\w+\]/gi, '').replace(/\n{3,}/g, '\n\n').trim(),
    meta: { ...(meta ?? {}), imagem: meta?.imagem ?? marca[1].toLowerCase() },
  };
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

type LinhaMsg = { direction: string; body: string | null; created_at: string };

/** A foto enviada pela Olivia é gravada como "[imagem: chave]". Devolvida assim ao
 *  modelo, ele imita o formato no texto e a foto nunca sai. Reescreve no formato
 *  real do protocolo: a tag META anexada à resposta anterior. */
function historicoParaIA(linhas: LinhaMsg[]): { role: 'user' | 'assistant'; content: string }[] {
  const saida: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of linhas) {
    if (!m.body || m.body.startsWith('[Áudio recebido')) continue;
    const foto = m.direction === 'outbound' ? m.body.match(/^\[imagem:\s*(\w+)\]$/) : null;
    if (foto) {
      const anterior = saida[saida.length - 1];
      if (anterior?.role === 'assistant') anterior.content += `\n[META: imagem=${foto[1]}]`;
      continue;
    }
    const inbound = m.direction === 'inbound';
    saida.push({
      role: inbound ? 'user' : 'assistant',
      // respostas antigas que já saíram com a marcação no texto não podem servir de modelo
      content: inbound ? m.body : m.body.replace(/\[imagem:\s*\w+\]\s*/gi, '').trim(),
    });
  }
  return saida;
}

/** Horas entre a última mensagem NOSSA e a volta da pessoa (primeira mensagem do
 *  bloco final de inbound). null se ainda não respondemos nada a ela. */
function horasDeSilencio(linhas: LinhaMsg[]): number | null {
  let i = linhas.length - 1;
  while (i >= 0 && linhas[i].direction === 'inbound') i--;
  if (i < 0 || i === linhas.length - 1) return null;
  const voltou = new Date(linhas[i + 1].created_at).getTime();
  const ultimaNossa = new Date(linhas[i].created_at).getTime();
  return (voltou - ultimaNossa) / 3_600_000;
}

async function responderComIA(supabase: SupabaseClient, conv: ConversaRow, mensagemAtual?: string) {
  const { data: historico } = await supabase
    .from('messages')
    .select('direction, body, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(40);

  // As 40 mais RECENTES (ascendente + limit pegava as 40 mais antigas e cortava
  // justamente o fim de conversas longas), devolvidas em ordem cronológica.
  const linhas = ((historico ?? []) as LinhaMsg[]).reverse();
  const mensagens = historicoParaIA(linhas);
  const silencio = horasDeSilencio(linhas);

  if (mensagemAtual) mensagens.push({ role: 'user', content: mensagemAtual });

  if (mensagens.length === 0) return;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: promptLead(silencio),
    messages: comNotaDeRetorno(mensagens, silencio),
  });

  const bruto = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const { texto: reply, meta } = extraiMeta(bruto);
  if (!reply) return;

  const { wamid } = await enviarTexto({ to: conv.phone_e164, body: reply });

  await supabase.from('messages').insert({
    conversation_id: conv.id, direction: 'outbound', sender_type: 'ia',
    body: reply, wamid, status: 'enviada',
  });

  // Primeira resposta da Olivia pra este lead: sai de 'novo' e marca que foi
  // atendido por ela — mesma semântica do botão manual "Iniciar com Olivia"
  // (admin/app/actions.ts), só que pro caminho orgânico (lead escreve
  // primeiro), que até aqui nunca atualizava o funil por conta própria.
  // Achado em produção (29/ago): 86 leads de WhatsApp com conversa real,
  // alguns já com handoff pra humano, presos em 'novo' pra sempre — o
  // painel não tinha como diferenciar quem já foi falado de quem não foi.
  // `.eq('status', 'novo')` torna idempotente: só a primeira resposta move.
  if (conv.lead_id) {
    await supabase.from('leads')
      .update({ status: 'contatado', atendido_por_ia: true })
      .eq('id', conv.lead_id)
      .eq('status', 'novo');
  }

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
        media_url: urlFoto,
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
