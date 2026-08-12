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

/** Referência viva da aba do WhatsApp, guardada em memória do módulo.
 *
 *  ⚠️ Por que NÃO dá para usar só um `target` nomeado no `window.open`:
 *  nomear a janela ("oli-whatsapp") só reaproveita a aba enquanto ela estiver
 *  no MESMO domínio. O painel e o web.whatsapp.com são domínios diferentes, e
 *  os navegadores **apagam o nome da janela ao navegar entre origens** — é
 *  proteção contra rastreamento entre sites. Resultado: a busca pelo nome
 *  falhava e cada clique empilhava uma aba. Foi o que aconteceu na primeira
 *  tentativa, em 07/ago.
 *
 *  Guardar a referência funciona porque três operações continuam permitidas
 *  numa janela de outra origem: ler `.closed`, chamar `.focus()` e ESCREVER
 *  em `.location.href`. Ler a URL dela, não — mas não precisamos. */
let janelaWhats: Window | null = null;

/** Abre a conversa reaproveitando a aba que o painel já abriu.
 *
 *  Se a pessoa recarregar o painel, a referência se perde e o próximo clique
 *  abre uma aba nova — daí em diante volta a reaproveitar. Não há como evitar:
 *  a referência vive na memória da página. */
export function abrirWhatsApp(numeroBruto: string | null | undefined, texto: string): void {
  const url = linkWhatsApp(numeroBruto, texto);

  if (janelaWhats && !janelaWhats.closed) {
    janelaWhats.location.href = url;
    janelaWhats.focus();
    return;
  }

  janelaWhats = window.open(url, '_blank');
  janelaWhats?.focus();
}

/** Primeira mensagem para um lead. Linguagem simples e sem jargão — quem lê é
 *  a pessoa, não a equipe. */
export function mensagemLead(nome: string | null | undefined): string {
  const primeiro = (nome ?? '').trim().split(/\s+/)[0] || 'tudo bem';
  return `Olá, ${primeiro}! Aqui é do OLI Health Hub. Vi que você demonstrou interesse nos nossos consultórios e queria entender melhor o que você precisa.`;
}
