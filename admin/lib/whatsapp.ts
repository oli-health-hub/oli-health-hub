/**
 * Link de conversa do WhatsApp — fonte única.
 *
 * Existe em arquivo próprio de propósito: a lógica é usada pela Fila e pela
 * tela de Leads, e duplicá-la foi o que produziu o bug de 07/ago (uma cópia
 * lia a chave errada do telefone e ninguém percebeu por meses).
 * Ver docs/HANDOFF.md §27.
 */

/** Normaliza o número para o formato que o link exige: só dígitos, com DDI.
 *
 *  Não dá para prefixar 55 cegamente — telefone de lead vem da RD já como
 *  "+5511950888026", e prefixar de novo geraria 555511950888026, ou seja,
 *  conversa com número inexistente.
 *
 *  Devolve null quando o número não dá para confiar (ex.: "922222799", sem
 *  DDD). Nesses casos é melhor abrir o WhatsApp sem destino do que mandar
 *  mensagem para a pessoa errada. */
export function numeroWhatsApp(bruto: string | undefined | null): string | null {
  if (!bruto) return null;
  const d = bruto.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) return d;          // já tem DDI
  if (d.length === 10 || d.length === 11)   return `55${d}`;   // DDD + número
  return null;                                                  // incompleto
}

/** Monta o link abrindo na mesma plataforma em que o painel está sendo usado.
 *
 *  No COMPUTADOR usa o WhatsApp Web de propósito: a conversa abre no mesmo
 *  navegador e no mesmo perfil do painel, então a conta que envia é a daquele
 *  perfil. Com `wa.me`, o sistema operacional sequestrava o link para o app
 *  desktop, que pode estar logado em outro número — quem usa mais de uma conta
 *  não tinha como escolher.
 *
 *  No CELULAR mantém `wa.me`, caminho certo para o aparelho abrir o app nativo.
 *
 *  ⚠️ Isto controla QUAL APLICATIVO abre, não qual número envia. Não existe
 *  parâmetro de conta no link — o WhatsApp não expõe isso. */
export function linkWhatsApp(numeroBruto: string | null | undefined, texto: string): string {
  const numero = numeroWhatsApp(numeroBruto);
  const msg    = encodeURIComponent(texto);

  const noCelular = typeof navigator !== 'undefined'
    && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!numero) {
    return noCelular ? `https://wa.me/?text=${msg}` : `https://web.whatsapp.com/send?text=${msg}`;
  }
  return noCelular
    ? `https://wa.me/${numero}?text=${msg}`
    : `https://web.whatsapp.com/send?phone=${numero}&text=${msg}`;
}

/** Nome fixo da janela. É isto que faz o navegador REAPROVEITAR a aba em vez de
 *  empilhar uma nova a cada clique: `window.open` com um `target` nomeado
 *  navega a janela existente com aquele nome; só `_blank` é que abre outra
 *  sempre.
 *
 *  Limite conhecido: só funciona para janelas abertas por esta própria página.
 *  Se o WhatsApp Web já estiver aberto numa aba que a pessoa abriu à mão, o
 *  navegador não deixa mirar nela — o primeiro clique vai abrir uma aba nossa,
 *  e daí em diante todos reaproveitam essa. */
const JANELA_WHATSAPP = 'oli-whatsapp';

/** Abre a conversa reaproveitando a janela já aberta pelo painel. */
export function abrirWhatsApp(numeroBruto: string | null | undefined, texto: string): void {
  const janela = window.open(linkWhatsApp(numeroBruto, texto), JANELA_WHATSAPP);
  // Reaproveitar a aba não a traz para a frente sozinho em todo navegador.
  janela?.focus();
}

/** Primeira mensagem para um lead. Linguagem simples e sem jargão — quem lê é
 *  a pessoa, não a equipe. */
export function mensagemLead(nome: string | null | undefined): string {
  const primeiro = (nome ?? '').trim().split(/\s+/)[0] || 'tudo bem';
  return `Olá, ${primeiro}! Aqui é do OLI Health Hub. Vi que você demonstrou interesse nos nossos consultórios e queria entender melhor o que você precisa.`;
}
