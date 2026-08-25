'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { sendConversationReply, toggleConversationMode } from '@/app/actions';

interface Conversa {
  id:               string;
  kind:             'lead' | 'patient' | 'nao_classificada';
  status:           'ia' | 'humano' | 'fechada';
  phone_e164:       string;
  last_message_at:  string | null;
  last_inbound_at:  string | null;
  lead_id:          string | null;
  patient_id:       string | null;
  professional_id:  string | null;
  leads:            { nome: string } | null;
  patients:         { nome: string } | null;
  profiles:         { nome: string } | null;
}

interface Mensagem {
  id:               string;
  conversation_id:  string;
  direction:        'inbound' | 'outbound';
  sender_type:      string;
  body:             string | null;
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

function nomeContato(c: Conversa): string {
  return c.leads?.nome ?? c.patients?.nome ?? c.phone_e164;
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
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conv = conversas.find(c => c.id === selecionada) ?? null;

  const loadMensagens = useCallback(async (conversationId: string) => {
    const { data } = await getSupabaseBrowser()
      .from('messages')
      .select('id, conversation_id, direction, sender_type, body, status, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMensagens((data as Mensagem[]) ?? []);
  }, []);

  useEffect(() => {
    if (selecionada) loadMensagens(selecionada);
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
          const atualizado = prev.map(c => c.id === msg.conversation_id ? { ...c, last_message_at: msg.created_at } : c);
          return [...atualizado].sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
        });
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
    if (!conv || !texto.trim()) return;
    setEnviando(true);
    setErro(null);
    const fd = new FormData();
    fd.set('conversation_id', conv.id);
    fd.set('texto', texto.trim());
    try {
      await sendConversationReply(fd);
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
      {/* Lista */}
      <div className="w-80 shrink-0 border-r border-oli-border overflow-y-auto">
        {conversas.length === 0 && (
          <p className="text-sm text-oli-lgray p-5">Nenhuma conversa ainda.</p>
        )}
        {conversas.map(c => (
          <button
            key={c.id}
            onClick={() => setSelecionada(c.id)}
            className={`w-full text-left px-4 py-3 border-b border-oli-border/60 hover:bg-stone-50 transition-colors ${selecionada === c.id ? 'bg-stone-50' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-oli-dark truncate">{nomeContato(c)}</span>
              <span className="text-[10px] text-oli-lgray shrink-0">{timeAgo(c.last_message_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${KIND_BG[c.kind]}`}>{KIND_LABEL[c.kind]}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{STATUS_LABEL[c.status]}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {!conv ? (
          <div className="flex-1 flex items-center justify-center text-sm text-oli-lgray">Selecione uma conversa</div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-oli-border flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-oli-dark">{nomeContato(conv)}</p>
                <p className="text-xs text-oli-lgray">{conv.phone_e164} {conv.profiles?.nome ? `· ${conv.profiles.nome}` : ''}</p>
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
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${m.direction === 'outbound' && m.sender_type !== 'ia' ? 'text-white/70' : 'text-oli-lgray'}`}>
                      {m.sender_type === 'ia' ? 'IA · ' : ''}{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !enviando) enviar(); }}
                  disabled={!dentroDaJanela || enviando}
                  placeholder={dentroDaJanela ? 'Escrever mensagem…' : 'Indisponível fora da janela de 24h'}
                  className="flex-1 text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green disabled:bg-gray-50 disabled:text-oli-lgray"
                />
                <button
                  onClick={enviar}
                  disabled={!dentroDaJanela || enviando || !texto.trim()}
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
