'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { sendConversationReply, sendConversationImage, toggleConversationMode, markConversationRead } from '@/app/actions';

interface Conversa {
  id:                       string;
  kind:                     'lead' | 'patient' | 'nao_classificada';
  status:                   'ia' | 'humano' | 'fechada';
  phone_e164:               string;
  last_message_at:          string | null;
  last_inbound_at:          string | null;
  last_message_direction:   'inbound' | 'outbound' | null;
  admin_last_read_at:       string | null;
  lead_id:                  string | null;
  patient_id:               string | null;
  professional_id:          string | null;
  leads:                    { nome: string } | null;
  patients:                 { nome: string } | null;
  profiles:                 { nome: string } | null;
}

interface Mensagem {
  id:               string;
  conversation_id:  string;
  direction:        'inbound' | 'outbound';
  sender_type:      string;
  body:             string | null;
  media_url:        string | null;
  status:           string;
  created_at:       string;
}

const KIND_LABEL: Record<Conversa['kind'], string> = {
  lead: 'Lead', patient: 'Paciente', nao_classificada: 'Não classificada',
};
const KIND_BG: Record<Conversa['kind'], string> = {
  lead: 'bg-blue-50 text-blue-700', patient: 'bg-green-50 text-oli-green', nao_classificada: 'bg-gray-100 text-gray-600',
};
const STATUS_LABEL: Record<Conversa['status'], string> = { ia: 'IA', humano: 'Humano', fechada: 'Fechada' };

/** Separa a lista em blocos operacionais — o que importa pra saber quem já
 *  foi assumido de quem ainda está com a Olivia, sem depender de decorar o
 *  significado do badge "Humano"/"IA" linha a linha. Paciente é sempre
 *  humano por regra do banco (chk_patient_never_ia), então vira grupo à
 *  parte — não é "assumido da Olivia", nunca foi dela. */
type Grupo = 'equipe' | 'pacientes' | 'olivia' | 'encerradas';
const GRUPO_LABEL: Record<Grupo, string> = {
  equipe: 'Assumidas pela equipe', pacientes: 'Pacientes',
  olivia: 'Com a Olivia', encerradas: 'Encerradas',
};
const ORDEM_GRUPOS: Grupo[] = ['equipe', 'pacientes', 'olivia', 'encerradas'];
function grupoDe(c: Conversa): Grupo {
  if (c.status === 'fechada') return 'encerradas';
  if (c.kind === 'patient') return 'pacientes';
  return c.status === 'ia' ? 'olivia' : 'equipe';
}

/** Aba da sidebar — separa o que é conduzido pela Olivia (fica bem no fim
 *  da lista, atrás de equipe/pacientes/encerradas) do resto, pra não
 *  precisar rolar até lá. "Equipe" reúne tudo que a equipe acompanha
 *  diretamente: assumidas, pacientes e encerradas. */
type Aba = 'equipe' | 'olivia';
const GRUPOS_DA_ABA: Record<Aba, Grupo[]> = {
  equipe: ['equipe', 'pacientes', 'encerradas'],
  olivia: ['olivia'],
};
function abaDoGrupo(g: Grupo): Aba {
  return g === 'olivia' ? 'olivia' : 'equipe';
}

function nomeContato(c: Conversa): string {
  return c.leads?.nome ?? c.patients?.nome ?? c.phone_e164;
}
/** Não lida = chegou/saiu mensagem depois da última vez que a equipe abriu
 *  essa conversa. admin_last_read_at nulo (nunca aberta) conta como não lida. */
function naoLida(c: Conversa): boolean {
  if (!c.last_message_at) return false;
  if (!c.admin_last_read_at) return true;
  return new Date(c.last_message_at) > new Date(c.admin_last_read_at);
}
/** De quem é a vez de responder: última mensagem inbound = aguardando a
 *  gente (IA ou equipe); outbound = aguardando o contato. Conversa encerrada
 *  não tem "vez de ninguém". */
function precisaNossaResposta(c: Conversa): boolean {
  return c.status !== 'fechada' && c.last_message_direction === 'inbound';
}
/** Tiques de entrega no estilo WhatsApp — só faz sentido em mensagem
 *  outbound, cujo `status` vem do webhook de status da Meta (enviada →
 *  entregue → lida, ou falhou). Cor muda pelo fundo da bolha: verde da
 *  equipe (`tom='staff'`) ou azul claro da IA (`tom='ia'`). */
function TiquesWhatsApp({ status, tom }: { status: string; tom: 'staff' | 'ia' }) {
  if (status === 'falhou') {
    return <span className="text-oli-red text-xs leading-none" title="Falha no envio">⚠</span>;
  }
  const lida = status === 'lida';
  const duplo = status === 'entregue' || status === 'lida';
  const cor = lida ? 'text-sky-400' : tom === 'staff' ? 'text-white/60' : 'text-blue-900/40';
  return (
    <svg viewBox="0 0 18 13" width="14" height="11" className={cor} fill="none" aria-hidden="true">
      <path d="M1 7.2 L5.2 11.4 L11 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {duplo && <path d="M6.3 7.2 L10.5 11.4 L17 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ConversasClient({ initial, initialId }: { initial: Conversa[]; initialId?: string | null }) {
  const [conversas, setConversas] = useState<Conversa[]>(initial);
  // Vem da notificação da Fila (?id=) quando existe — senão cai na mais
  // recente, comportamento de antes.
  const [selecionada, setSelecionada] = useState<string | null>(initialId ?? initial[0]?.id ?? null);
  // Abre na aba de quem a conversa inicial pertence — sem isso, um link de
  // notificação pra uma conversa da Olivia cairia na aba errada e pareceria
  // que a seleção não funcionou.
  const [aba, setAba] = useState<Aba>(() => {
    const selecionadaInicial = initial.find(c => c.id === (initialId ?? initial[0]?.id));
    return selecionadaInicial ? abaDoGrupo(grupoDe(selecionadaInicial)) : 'equipe';
  });
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Foto anexada, ainda não enviada — texto vira legenda quando junto de uma
  // imagem, mesmo campo faz os dois papéis sem duplicar UI.
  const [imagem, setImagem] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TIPOS_IMAGEM_ACEITOS = ['image/jpeg', 'image/png'];
  const TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024; // 5MB — mesmo limite da Meta

  function selecionarImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!TIPOS_IMAGEM_ACEITOS.includes(arquivo.type)) {
      setErro('Formato não aceito — envie JPEG ou PNG.');
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
      setErro('Imagem maior que 5MB — reduza o tamanho antes de enviar.');
      return;
    }
    setErro(null);
    setImagem(arquivo);
    setPreviewUrl(URL.createObjectURL(arquivo));
  }

  function removerImagem() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImagem(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const conv = conversas.find(c => c.id === selecionada) ?? null;

  const loadMensagens = useCallback(async (conversationId: string) => {
    const { data } = await getSupabaseBrowser()
      .from('messages')
      .select('id, conversation_id, direction, sender_type, body, media_url, status, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMensagens((data as Mensagem[]) ?? []);
  }, []);

  /** Otimista local + grava no banco — outras abas/pessoas com o painel
   *  aberto recebem via UPDATE realtime em conversations. */
  const marcarComoLida = useCallback((conversationId: string) => {
    const agora = new Date().toISOString();
    setConversas(prev => prev.map(c => c.id === conversationId ? { ...c, admin_last_read_at: agora } : c));
    markConversationRead(conversationId).catch(err => console.error('[conversas] falha ao marcar como lida:', err));
  }, []);

  useEffect(() => {
    if (selecionada) {
      loadMensagens(selecionada);
      marcarComoLida(selecionada);
    }
    // Troca de conversa não pode carregar uma foto anexada pra outro contato.
    removerImagem();
    setTexto('');
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada, loadMensagens]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Realtime: novas mensagens (atualiza thread aberta + reordena lista) e
  // novas conversas (aparecem na lista sem precisar recarregar a página).
  useEffect(() => {
    const channel = getSupabaseBrowser()
      .channel('conversas_admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Mensagem;
        setMensagens(prev => (prev.some(m => m.id === msg.id) || msg.conversation_id !== selecionada) ? prev : [...prev, msg]);
        setConversas(prev => {
          const atualizado = prev.map(c => c.id === msg.conversation_id
            ? { ...c, last_message_at: msg.created_at, last_message_direction: msg.direction }
            : c);
          return [...atualizado].sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
        });
        // A conversa aberta já mostra a mensagem nova na hora — conta como lida.
        if (msg.conversation_id === selecionada) marcarComoLida(msg.conversation_id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        setConversas(prev => [payload.new as Conversa, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        setConversas(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } as Conversa : c));
      })
      .subscribe();

    return () => { getSupabaseBrowser().removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada]);

  async function enviar() {
    if (!conv || (!texto.trim() && !imagem)) return;
    setEnviando(true);
    setErro(null);
    try {
      if (imagem) {
        const fd = new FormData();
        fd.set('conversation_id', conv.id);
        fd.set('imagem', imagem);
        if (texto.trim()) fd.set('legenda', texto.trim());
        await sendConversationImage(fd);
        removerImagem();
      } else {
        const fd = new FormData();
        fd.set('conversation_id', conv.id);
        fd.set('texto', texto.trim());
        await sendConversationReply(fd);
      }
      setTexto('');
      await loadMensagens(conv.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.');
    } finally {
      setEnviando(false);
    }
  }

  async function alternarModo(novoStatus: 'ia' | 'humano') {
    if (!conv) return;
    const fd = new FormData();
    fd.set('conversation_id', conv.id);
    fd.set('novo_status', novoStatus);
    await toggleConversationMode(fd);
    setConversas(prev => prev.map(c => c.id === conv.id ? { ...c, status: novoStatus } : c));
  }

  const dentroDaJanela = conv?.last_inbound_at
    ? (Date.now() - new Date(conv.last_inbound_at).getTime()) / 3_600_000 <= 24
    : false;

  return (
    <div className="flex h-[calc(100%-4.5rem)] bg-white rounded-2xl border border-oli-border overflow-hidden">
      {/* Lista — no celular ocupa a tela inteira; some quando uma conversa
          está aberta (aí é a thread que ocupa). Do md pra cima, as duas
          colunas ficam lado a lado como sempre. */}
      <div className={`w-full md:w-80 shrink-0 border-oli-border md:border-r flex-col min-h-0 ${selecionada ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex gap-1.5 p-2.5 border-b border-oli-border shrink-0">
          {(['equipe', 'olivia'] as const).map(a => {
            const doAba = conversas.filter(c => GRUPOS_DA_ABA[a].includes(grupoDe(c)));
            const total = doAba.length;
            const naoLidas = doAba.filter(naoLida).length;
            return (
              <button
                key={a}
                onClick={() => setAba(a)}
                className={`relative flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  aba === a ? 'bg-oli-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {a === 'equipe' ? 'Equipe' : 'Olivia'} <span className="opacity-70">{total}</span>
                {naoLidas > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-oli-red text-white text-[10px] font-bold leading-none">
                    {naoLidas}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
        {conversas.length === 0 && (
          <p className="text-sm text-oli-lgray p-5">Nenhuma conversa ainda.</p>
        )}
        {ORDEM_GRUPOS.filter(grupo => GRUPOS_DA_ABA[aba].includes(grupo)).map(grupo => {
          const itens = conversas.filter(c => grupoDe(c) === grupo);
          if (itens.length === 0) return null;
          return (
            <div key={grupo}>
              <div className="sticky top-0 z-10 px-4 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 font-semibold bg-stone-50 border-b border-oli-border/60">
                {GRUPO_LABEL[grupo]} <span className="opacity-60">{itens.length}</span>
              </div>
              {itens.map(c => {
                const lida = !naoLida(c);
                const aguardandoNos = precisaNossaResposta(c);
                // Borda esquerda diz de quem é a vez: vermelho = aguardando
                // nossa resposta (IA ou equipe), verde = já respondemos e
                // esperamos o contato. Encerrada não tem vez de ninguém.
                const bordaResposta = c.status === 'fechada'
                  ? 'border-l-transparent'
                  : aguardandoNos ? 'border-l-oli-red' : 'border-l-oli-green/50';
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelecionada(c.id)}
                    className={`w-full text-left pl-3.5 pr-4 py-3 border-b border-l-[3px] border-oli-border/60 ${bordaResposta} transition-colors ${
                      selecionada === c.id ? 'bg-stone-50' : !lida ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${!lida ? 'font-bold text-oli-dark' : 'font-semibold text-oli-dark'}`}>{nomeContato(c)}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {!lida && <span className="w-2 h-2 rounded-full bg-oli-gold" aria-label="Não lida" />}
                        <span className="text-[10px] text-oli-lgray">{timeAgo(c.last_message_at)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${KIND_BG[c.kind]}`}>{KIND_LABEL[c.kind]}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{STATUS_LABEL[c.status]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
        </div>
      </div>

      {/* Thread */}
      <div className={`flex-1 flex-col min-w-0 ${selecionada ? 'flex' : 'hidden md:flex'}`}>
        {!conv ? (
          <div className="flex-1 flex items-center justify-center text-sm text-oli-lgray">Selecione uma conversa</div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-oli-border flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {/* Voltar pra lista — só no celular, onde as colunas empilham. */}
                <button
                  onClick={() => setSelecionada(null)}
                  aria-label="Voltar pra lista de conversas"
                  className="md:hidden shrink-0 w-8 h-8 -ml-1.5 rounded-lg flex items-center justify-center text-oli-lgray hover:bg-stone-50"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-oli-dark truncate">{nomeContato(conv)}</p>
                  <p className="text-xs text-oli-lgray truncate">{conv.phone_e164} {conv.profiles?.nome ? `· ${conv.profiles.nome}` : ''}</p>
                </div>
              </div>
              {conv.kind === 'lead' && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => alternarModo('ia')}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${conv.status === 'ia' ? 'bg-oli-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >IA</button>
                  <button
                    onClick={() => alternarModo('humano')}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${conv.status === 'humano' ? 'bg-oli-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >Humano</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {mensagens.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                    m.direction === 'outbound'
                      ? (m.sender_type === 'ia' ? 'bg-blue-50 text-blue-900' : 'bg-oli-green text-white')
                      : 'bg-gray-100 text-oli-dark'
                  }`}>
                    {/* Prévia da imagem — sem isso a mensagem só mostrava o
                        texto genérico "[imagem enviada pela equipe]"/"[imagem:
                        especialidade]", sem dar pra saber qual foto foi essa. */}
                    {m.media_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.media_url}
                        alt="Imagem enviada na conversa"
                        onClick={() => window.open(m.media_url!, '_blank')}
                        className="rounded-xl max-w-full max-h-64 mb-1 cursor-zoom-in"
                      />
                    )}
                    {/* Some só quando a prévia já apareceu — se o upload da
                        cópia falhou (media_url nulo), o texto genérico vira o
                        único indício de que uma foto foi enviada. */}
                    {m.body && !(m.media_url && m.body.startsWith('[imagem')) && (
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    )}
                    <p className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${m.direction === 'outbound' && m.sender_type !== 'ia' ? 'text-white/70' : 'text-oli-lgray'}`}>
                      <span>{m.sender_type === 'ia' ? 'IA · ' : ''}{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {m.direction === 'outbound' && <TiquesWhatsApp status={m.status} tom={m.sender_type === 'ia' ? 'ia' : 'staff'} />}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="px-5 py-3 border-t border-oli-border">
              {!dentroDaJanela && (
                <p className="text-xs text-oli-red mb-2">
                  Fora da janela de 24h — texto livre não é aceito pela Meta. Use um template (na tela do médico) ou espere o contato responder.
                </p>
              )}
              {erro && <p className="text-xs text-oli-red mb-2">{erro}</p>}
              {/* Prévia da foto anexada — o texto abaixo vira legenda dela,
                  não uma segunda mensagem. Some com o X ou depois de enviar. */}
              {previewUrl && (
                <div className="flex items-center gap-2 mb-2 bg-stone-50 border border-oli-border rounded-xl px-2 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Prévia da foto a enviar" className="w-12 h-12 object-cover rounded-lg" />
                  <span className="text-xs text-oli-lgray truncate flex-1">{imagem?.name}</span>
                  <button
                    onClick={removerImagem}
                    disabled={enviando}
                    className="text-xs text-oli-red font-semibold px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remover
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={e => selecionarImagem(e.target.files?.[0])}
                  disabled={!dentroDaJanela || enviando}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!dentroDaJanela || enviando}
                  title="Anexar foto"
                  className="shrink-0 text-lg px-3 py-2 rounded-xl border border-oli-border text-oli-lgray hover:bg-stone-50 transition-colors disabled:opacity-40"
                >
                  📎
                </button>
                <input
                  type="text"
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !enviando) enviar(); }}
                  disabled={!dentroDaJanela || enviando}
                  placeholder={!dentroDaJanela ? 'Indisponível fora da janela de 24h' : imagem ? 'Legenda da foto (opcional)…' : 'Escrever mensagem…'}
                  className="flex-1 text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green disabled:bg-gray-50 disabled:text-oli-lgray"
                />
                <button
                  onClick={enviar}
                  disabled={!dentroDaJanela || enviando || (!texto.trim() && !imagem)}
                  className="text-sm font-semibold px-4 py-2 rounded-xl bg-oli-green text-white hover:bg-oli-green/80 transition-colors disabled:opacity-40"
                >
                  {enviando ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
