'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, ArrowLeft, Paperclip, SendHorizontal, X, SlidersHorizontal, ChevronDown, Bot, Headset, Flame, BellRing, Lock, UserRound, TimerOff, HelpCircle, type LucideIcon } from 'lucide-react';
import { STATUS_LABEL as LEAD_STATUS, TEMPERATURA_LABEL, ORIGEM_LABEL } from '@/lib/lead-labels';
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
  leads:                    { nome: string; status: string | null; temperatura: string | null; origem: string | null } | null;
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
  const cor = lida ? 'text-sky-500' : tom === 'staff' ? 'text-oli-lgray' : 'text-blue-900/40';
  return (
    <svg viewBox="0 0 18 13" width="14" height="11" className={cor} fill="none" aria-hidden="true">
      <path d="M1 7.2 L5.2 11.4 L11 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {duplo && <path d="M6.3 7.2 L10.5 11.4 L17 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
/** Etiqueta visual de uma conversa. Todas são derivadas de dados que já existem
 *  (conversations + leads), sem tabela nova: quem atende, de quem é a vez, janela de 24h,
 *  e situação/temperatura/origem do lead. */
interface Etiqueta {
  id:     string;
  texto:  string;
  classe: string;
  Icone?: LucideIcon;
}

function foraDaJanela(c: Conversa): boolean {
  if (c.status === 'fechada' || !c.last_inbound_at) return false;
  return (Date.now() - new Date(c.last_inbound_at).getTime()) / 3_600_000 > 24;
}

function etiquetasDe(c: Conversa): Etiqueta[] {
  const lista: Etiqueta[] = [];
  if (precisaNossaResposta(c)) {
    lista.push({ id: 'aguardando', texto: 'Aguardando resposta', classe: 'bg-red-50 text-red-600', Icone: BellRing });
  }
  if (c.status === 'fechada') {
    lista.push({ id: 'fechada', texto: 'Encerrada', classe: 'bg-gray-100 text-gray-500', Icone: Lock });
  } else if (c.kind === 'patient') {
    lista.push({ id: 'paciente', texto: 'Paciente', classe: 'bg-green-50 text-oli-green', Icone: UserRound });
  } else if (c.status === 'ia') {
    lista.push({ id: 'ia', texto: 'Olivia (IA)', classe: 'bg-blue-50 text-blue-700', Icone: Bot });
  } else {
    lista.push({ id: 'humano', texto: 'Equipe', classe: 'bg-green-50 text-oli-green', Icone: Headset });
  }
  if (c.kind === 'nao_classificada') {
    lista.push({ id: 'nao-classificada', texto: 'Não classificada', classe: 'bg-gray-100 text-gray-600', Icone: HelpCircle });
  }
  const lead = c.leads;
  const temp = lead?.temperatura ? TEMPERATURA_LABEL[lead.temperatura] : null;
  if (temp && lead?.temperatura) {
    lista.push({
      id: 'temperatura',
      texto: temp.label.replace('🔥 ', ''),
      classe: `${temp.bg} ${temp.text}`,
      Icone: lead.temperatura === 'quente' ? Flame : undefined,
    });
  }
  const situacao = lead?.status ? LEAD_STATUS[lead.status] : null;
  if (situacao) lista.push({ id: 'situacao', texto: situacao.label, classe: `${situacao.bg} ${situacao.text}` });
  if (lead?.origem) {
    lista.push({ id: 'origem', texto: ORIGEM_LABEL[lead.origem] ?? lead.origem, classe: 'bg-stone-100 text-stone-600' });
  }
  if (foraDaJanela(c)) {
    lista.push({ id: 'janela', texto: 'Fora da janela 24h', classe: 'bg-amber-50 text-amber-700', Icone: TimerOff });
  }
  return lista;
}

function EtiquetaChip({ e }: { e: Etiqueta }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold ${e.classe}`}>
      {e.Icone && <e.Icone className="h-2.5 w-2.5" aria-hidden="true" />}
      {e.texto}
    </span>
  );
}

function inicialDe(nome: string): string {
  return (nome.trim().charAt(0) || '?').toUpperCase();
}

const SP = 'America/Sao_Paulo';
function chaveDia(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: SP });
}
function rotuloDia(iso: string): string {
  const hoje = chaveDia(new Date().toISOString());
  const ontem = chaveDia(new Date(Date.now() - 86_400_000).toISOString());
  const k = chaveDia(iso);
  if (k === hoje) return 'Hoje';
  if (k === ontem) return 'Ontem';
  return k;
}

/** Fundo do chat: bege do WhatsApp com um padrão discreto de pontos. */
const FUNDO_CHAT = {
  backgroundImage: 'radial-gradient(rgba(11,20,26,0.045) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
} as const;

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
  const [busca, setBusca] = useState('');
  const [painelAberto, setPainelAberto] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [fVez, setFVez] = useState('todas');
  const [fAtend, setFAtend] = useState('todos');
  const [fTemp, setFTemp] = useState('todos');
  const [fSituacao, setFSituacao] = useState('todos');
  const [fOrigem, setFOrigem] = useState('todos');
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

  const termo = busca.trim().toLowerCase();
  function atendimentoDe(c: Conversa): string {
    if (c.status === 'fechada') return 'fechada';
    if (c.kind === 'patient') return 'paciente';
    return c.status;
  }
  function passaNoFiltro(c: Conversa): boolean {
    if (termo && !`${nomeContato(c)} ${c.phone_e164}`.toLowerCase().includes(termo)) return false;
    if (fVez === 'nao_lidas' && !naoLida(c)) return false;
    if (fVez === 'aguardando' && !precisaNossaResposta(c)) return false;
    if (fVez === 'fora_janela' && !foraDaJanela(c)) return false;
    if (fAtend !== 'todos' && atendimentoDe(c) !== fAtend) return false;
    if (fTemp !== 'todos' && c.leads?.temperatura !== fTemp) return false;
    if (fSituacao !== 'todos' && c.leads?.status !== fSituacao) return false;
    if (fOrigem !== 'todos' && c.leads?.origem !== fOrigem) return false;
    return true;
  }
  const filtrosAtivos = [fVez, fAtend, fTemp, fSituacao, fOrigem].filter(v => v !== 'todos' && v !== 'todas').length;
  function limparFiltros() {
    setFVez('todas'); setFAtend('todos'); setFTemp('todos'); setFSituacao('todos'); setFOrigem('todos');
  }
  function alternarExpandida(id: string) {
    setExpandidas(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  const CAMPOS_FILTRO: { rotulo: string; valor: string; set: (v: string) => void; todos: string; opcoes: [string, string][] }[] = [
    { rotulo: 'Vez de responder', valor: fVez, set: setFVez, todos: 'todas', opcoes: [['todas', 'Todas'], ['aguardando', 'Aguardando nossa resposta'], ['nao_lidas', 'Não lidas'], ['fora_janela', 'Fora da janela de 24h']] },
    { rotulo: 'Atendimento', valor: fAtend, set: setFAtend, todos: 'todos', opcoes: [['todos', 'Todos'], ['ia', 'Olivia (IA)'], ['humano', 'Equipe'], ['paciente', 'Paciente'], ['fechada', 'Encerrada']] },
    { rotulo: 'Temperatura', valor: fTemp, set: setFTemp, todos: 'todos', opcoes: [['todos', 'Todas'], ...Object.entries(TEMPERATURA_LABEL).map(([k, m]): [string, string] => [k, m.label.replace('🔥 ', '')])] },
    { rotulo: 'Situação do lead', valor: fSituacao, set: setFSituacao, todos: 'todos', opcoes: [['todos', 'Todas'], ...Object.entries(LEAD_STATUS).map(([k, m]): [string, string] => [k, m.label])] },
    { rotulo: 'Origem', valor: fOrigem, set: setFOrigem, todos: 'todos', opcoes: [['todos', 'Todas'], ...Object.entries(ORIGEM_LABEL).map(([k, l]): [string, string] => [k, l])] },
  ];

  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-oli-border bg-white">
      {/* Lista — no celular ocupa a tela inteira; some quando uma conversa
          está aberta (aí é a thread que ocupa). Do md pra cima, as duas
          colunas ficam lado a lado como sempre. */}
      <div className={`w-full min-h-0 shrink-0 flex-col border-oli-border md:w-[22rem] md:border-r ${selecionada ? 'hidden md:flex' : 'flex'}`}>
        <div className="shrink-0 space-y-2 bg-[#F0F2F5] p-2.5">
          <div className="flex gap-1.5">
            {(['equipe', 'olivia'] as const).map(a => {
              const doAba = conversas.filter(c => GRUPOS_DA_ABA[a].includes(grupoDe(c)));
              const total = doAba.length;
              const naoLidas = doAba.filter(naoLida).length;
              return (
                <button
                  key={a}
                  onClick={() => setAba(a)}
                  aria-pressed={aba === a}
                  aria-label={`Aba ${a === 'equipe' ? 'Equipe' : 'Olivia'}, ${total} conversas, ${naoLidas} não lidas`}
                  className={`relative flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    aba === a ? 'bg-[#00A884] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {a === 'equipe' ? 'Equipe' : 'Olivia'} <span className="opacity-70">{total}</span>
                  {naoLidas > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-oli-red px-1 text-[10px] font-bold leading-none text-white">
                      {naoLidas}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oli-lgray" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              aria-label="Buscar conversa por nome ou telefone"
              className="h-9 w-full rounded-lg border-0 bg-white pl-9 pr-3 text-sm text-oli-dark focus:outline-none focus:ring-2 focus:ring-[#00A884]/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setPainelAberto(v => !v)}
            aria-expanded={painelAberto}
            aria-label={`Filtros${filtrosAtivos ? `, ${filtrosAtivos} ativos` : ''}`}
            className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-xs font-semibold transition-colors duration-150 ${
              painelAberto || filtrosAtivos ? 'bg-[#D9FDD3] text-[#0B6B4F]' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-150 ease-out ${painelAberto ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {painelAberto && (
            <div className="space-y-2 rounded-lg bg-white p-2.5">
              {CAMPOS_FILTRO.map(f => (
                <label key={f.rotulo} className="block">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-oli-lgray">{f.rotulo}</span>
                  <select
                    value={f.valor}
                    onChange={e => f.set(e.target.value)}
                    aria-label={`Filtrar por ${f.rotulo.toLowerCase()}`}
                    className={`h-8 w-full rounded-lg border bg-white px-2 text-xs text-oli-dark focus:outline-none focus:ring-2 focus:ring-[#00A884]/40 ${
                      f.valor !== f.todos ? 'border-[#00A884] font-semibold' : 'border-oli-border'
                    }`}
                  >
                    {f.opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              ))}
              {filtrosAtivos > 0 && (
                <button type="button" onClick={limparFiltros} className="text-xs font-semibold text-[#0B6B4F] underline-offset-2 hover:underline">
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversas.length === 0 && (
            <p className="p-5 text-sm text-oli-lgray">Nenhuma conversa ainda.</p>
          )}
          {ORDEM_GRUPOS.filter(grupo => GRUPOS_DA_ABA[aba].includes(grupo)).map(grupo => {
            const itens = conversas.filter(c => grupoDe(c) === grupo && passaNoFiltro(c));
            if (itens.length === 0) return null;
            return (
              <div key={grupo}>
                <div className="sticky top-0 z-10 border-b border-oli-border/60 bg-stone-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {GRUPO_LABEL[grupo]} <span className="opacity-60">{itens.length}</span>
                </div>
                {itens.map(c => {
                  const lida = !naoLida(c);
                  const nome = nomeContato(c);
                  const etiquetas = etiquetasDe(c);
                  const resumo = etiquetas.slice(0, 2);
                  const aberta = expandidas.has(c.id);
                  const resto = etiquetas.slice(2);
                  return (
                    <div
                      key={c.id}
                      className={`relative border-b border-oli-border/50 transition-colors duration-150 ${
                        selecionada === c.id ? 'bg-[#F0F2F5]' : 'hover:bg-[#F5F6F6]'
                      }`}
                    >
                      <button
                        onClick={() => setSelecionada(c.id)}
                        aria-label={`Abrir conversa com ${nome}${lida ? '' : ', não lida'}`}
                        className="flex w-full items-center gap-2.5 py-2 pl-3 pr-10 text-left"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            c.kind === 'patient' ? 'bg-oli-green/20 text-oli-green' : c.kind === 'lead' ? 'bg-sky-100 text-sky-700' : 'bg-gray-200 text-gray-600'
                          }`}
                          aria-hidden="true"
                        >
                          {inicialDe(nome)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm text-oli-dark ${!lida ? 'font-bold' : 'font-semibold'}`}>{nome}</span>
                            <span className={`flex shrink-0 items-center gap-1.5 text-[11px] ${!lida ? 'font-semibold text-[#00A884]' : 'text-oli-lgray'}`}>
                              {!lida && <span className="h-2 w-2 rounded-full bg-[#25D366]" aria-label="Não lida" />}
                              {timeAgo(c.last_message_at)}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center gap-1 overflow-hidden">
                            {resumo.map(e => <EtiquetaChip key={e.id} e={e} />)}
                          </span>
                        </span>
                      </button>
                      {resto.length > 0 && (
                        <button
                          type="button"
                          onClick={() => alternarExpandida(c.id)}
                          aria-expanded={aberta}
                          aria-label={`${aberta ? 'Recolher' : 'Ver'} todas as etiquetas de ${nome}`}
                          className="absolute bottom-1.5 right-1.5 flex h-7 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-bold text-oli-gray transition-transform duration-150 ease-out hover:bg-black/5 active:scale-95"
                        >
                          {!aberta && <span>+{resto.length}</span>}
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ease-out ${aberta ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                      )}
                      {aberta && (
                        <div className="flex flex-wrap gap-1 pb-2.5 pl-[3.75rem] pr-3">
                          {resto.map(e => <EtiquetaChip key={e.id} e={e} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className={`min-w-0 flex-1 flex-col ${selecionada ? 'flex' : 'hidden md:flex'}`}>
        {!conv ? (
          <div className="flex flex-1 items-center justify-center bg-[#F0F2F5] text-sm text-oli-lgray">Selecione uma conversa</div>
        ) : (
          <>
            <div className="shrink-0 border-b border-oli-border bg-[#F0F2F5] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  {/* Voltar pra lista — só no celular, onde as colunas empilham. */}
                  <button
                    onClick={() => setSelecionada(null)}
                    aria-label="Voltar para a lista de conversas"
                    className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-oli-gray transition-transform duration-150 ease-out hover:bg-black/5 active:scale-95 md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-base font-bold text-sky-700"
                    aria-hidden="true"
                  >
                    {inicialDe(nomeContato(conv))}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-oli-dark">{nomeContato(conv)}</p>
                    <p className="truncate text-xs text-oli-gray">{conv.phone_e164} {conv.profiles?.nome ? `· ${conv.profiles.nome}` : ''}</p>
                  </div>
                </div>
                {conv.kind === 'lead' && (
                  <div className="flex shrink-0 gap-1 rounded-full bg-white p-0.5" role="group" aria-label="Quem atende a conversa">
                    <button
                      onClick={() => alternarModo('ia')}
                      aria-pressed={conv.status === 'ia'}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ${conv.status === 'ia' ? 'bg-[#00A884] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >IA</button>
                    <button
                      onClick={() => alternarModo('humano')}
                      aria-pressed={conv.status === 'humano'}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ${conv.status === 'humano' ? 'bg-[#00A884] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >Humano</button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1" aria-label="Etiquetas da conversa">
                {etiquetasDe(conv).map(e => <EtiquetaChip key={e.id} e={e} />)}
              </div>
            </div>

            <div
              className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-[#EFE7DD] px-3 py-4 md:px-8"
              style={FUNDO_CHAT}
            >
              {mensagens.map((m, i) => {
                const saida = m.direction === 'outbound';
                const ia = m.sender_type === 'ia';
                const anterior = mensagens[i - 1];
                const novoDia = !anterior || chaveDia(anterior.created_at) !== chaveDia(m.created_at);
                const primeiraDoGrupo = novoDia || anterior.direction !== m.direction;
                const cor = saida ? (ia ? 'bg-[#DDEBFF]' : 'bg-[#D9FDD3]') : 'bg-white';
                const canto = primeiraDoGrupo ? (saida ? 'rounded-tr-none' : 'rounded-tl-none') : '';
                return (
                  <div key={m.id}>
                    {novoDia && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-semibold text-oli-gray shadow-sm">
                          {rotuloDia(m.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${saida ? 'justify-end' : 'justify-start'} ${primeiraDoGrupo ? 'mt-2' : ''}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm text-oli-dark shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] md:max-w-[70%] ${cor} ${canto}`}>
                        {saida && ia && <p className="mb-0.5 text-[11px] font-bold text-blue-700">Olivia (IA)</p>}
                        {/* Prévia da imagem — sem isso a mensagem só mostrava o
                            texto genérico "[imagem enviada pela equipe]"/"[imagem:
                            especialidade]", sem dar pra saber qual foto foi essa. */}
                        {m.media_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.media_url}
                            alt="Imagem enviada na conversa"
                            onClick={() => window.open(m.media_url!, '_blank')}
                            className="mb-1 max-h-64 max-w-full cursor-zoom-in rounded-md"
                          />
                        )}
                        {/* Some só quando a prévia já apareceu — se o upload da
                            cópia falhou (media_url nulo), o texto genérico vira o
                            único indício de que uma foto foi enviada. */}
                        {m.body && !(m.media_url && m.body.startsWith('[imagem')) && (
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        )}
                        <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-oli-lgray">
                          <span>{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: SP })}</span>
                          {saida && <TiquesWhatsApp status={m.status} tom="staff" />}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 bg-[#F0F2F5] py-2 pl-[4.75rem] pr-2.5 md:px-3">
              {!dentroDaJanela && (
                <p className="mb-2 text-xs text-oli-red">
                  Fora da janela de 24h — texto livre não é aceito pela Meta. Use um template (na tela do médico) ou espere o contato responder.
                </p>
              )}
              {erro && <p className="mb-2 text-xs text-oli-red">{erro}</p>}
              {/* Prévia da foto anexada — o texto abaixo vira legenda dela,
                  não uma segunda mensagem. Some com o X ou depois de enviar. */}
              {previewUrl && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-oli-border bg-white px-2 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Prévia da foto a enviar" className="h-12 w-12 rounded-lg object-cover" />
                  <span className="flex-1 truncate text-xs text-oli-lgray">{imagem?.name}</span>
                  <button
                    onClick={removerImagem}
                    disabled={enviando}
                    aria-label="Remover a foto anexada"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-oli-red transition-colors hover:bg-red-50"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
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
                  aria-label="Anexar foto"
                  title="Anexar foto"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-oli-gray transition-colors hover:bg-black/5 disabled:opacity-40"
                >
                  <Paperclip className="h-5 w-5" aria-hidden="true" />
                </button>
                <input
                  type="text"
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !enviando) enviar(); }}
                  disabled={!dentroDaJanela || enviando}
                  aria-label="Mensagem"
                  placeholder={!dentroDaJanela ? 'Indisponível fora da janela de 24h' : imagem ? 'Legenda da foto (opcional)…' : 'Escrever mensagem…'}
                  className="h-10 min-w-0 flex-1 rounded-full border-0 bg-white px-4 text-sm text-oli-dark focus:outline-none focus:ring-2 focus:ring-[#00A884]/40 disabled:bg-gray-50 disabled:text-oli-lgray"
                />
                <button
                  onClick={enviar}
                  disabled={!dentroDaJanela || enviando || (!texto.trim() && !imagem)}
                  aria-label={enviando ? 'Enviando mensagem' : 'Enviar mensagem'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white transition-transform duration-150 ease-out active:scale-95 disabled:opacity-40"
                >
                  <SendHorizontal className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
