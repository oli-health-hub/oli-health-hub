'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { abrirWhatsApp, mensagemLead } from '@/lib/whatsapp';

type NotifType = 'new_signup' | 'module_purchased' | 'module_activated' | 'plan_subscribed' | 'plan_activated' | 'lead_received' | 'whatsapp_message_received';

interface QueueItem {
  id:              string;
  type:            NotifType;
  title:           string;
  body:            string | null;
  metadata:        Record<string, unknown>;
  created_at:      string;
  professional_id: string | null;
  profiles:        { nome: string; crm: string | null; especialidade: string | null; plan: string | null; whatsapp: string | null } | null;
}

const TYPE_TAG: Record<NotifType, { label: string; color: string }> = {
  new_signup:       { label: 'Novo cadastro',    color: 'bg-green-50 text-oli-green'      },
  module_purchased: { label: 'Módulo contratado',color: 'bg-yellow-50 text-yellow-700'    },
  module_activated: { label: 'Módulo ativado',   color: 'bg-yellow-50 text-yellow-700'    },
  plan_subscribed:  { label: 'Plano contratado', color: 'bg-blue-50 text-blue-700'        },
  plan_activated:   { label: 'Plano ativado',    color: 'bg-blue-50 text-blue-700'        },
  lead_received:    { label: 'Novo lead',        color: 'bg-amber-50 text-amber-700'      },
  whatsapp_message_received: { label: 'WhatsApp', color: 'bg-emerald-50 text-emerald-700' },
};

// Origem só existe em metadata de `lead_received` — RD Station, formulário do
// site, captação via WhatsApp, etc. É o que diferencia "lead do RD" de "lead
// do WhatsApp" dentro da própria seção de leads.
const ORIGEM_TAG: Record<string, { label: string; color: string }> = {
  site:       { label: 'Site',        color: 'bg-gray-100 text-gray-600'   },
  rd_station: { label: 'RD Station',  color: 'bg-indigo-50 text-indigo-700' },
  meta_ads:   { label: 'Meta Ads',    color: 'bg-blue-50 text-blue-700'    },
  whatsapp:   { label: 'WhatsApp',    color: 'bg-emerald-50 text-emerald-700' },
  indicacao:  { label: 'Indicação',   color: 'bg-purple-50 text-purple-700' },
  evento:     { label: 'Evento',      color: 'bg-pink-50 text-pink-700'    },
};

const SECOES: { titulo: string; tipos: NotifType[] }[] = [
  { titulo: 'Leads para atender',     tipos: ['lead_received'] },
  { titulo: 'Mensagens no WhatsApp',  tipos: ['whatsapp_message_received'] },
  { titulo: 'Cadastros e assinaturas', tipos: ['new_signup', 'module_purchased', 'module_activated', 'plan_subscribed', 'plan_activated'] },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function FilaClient({ initialItems }: { initialItems: QueueItem[] }) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);

  // Realtime: novos itens entram no topo da fila
  useEffect(() => {
    const channel = getSupabaseBrowser()
      .channel('fila_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          setItems(prev => [payload.new as QueueItem, ...prev]);
        })
      .subscribe();
    return () => { getSupabaseBrowser().removeChannel(channel); };
  }, []);

  async function dismiss(id: string) {
    await getSupabaseBrowser()
      .from('admin_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    setItems(prev => prev.filter(n => n.id !== id));
  }

  function openWhatsApp(item: QueueItem) {
    // Lead não tem perfil no sistema — o nome vive no metadata. Sem isto o
    // texto começava com "Olá, Médico!" na conversa com um lead.
    const nome = item.profiles?.nome ?? (item.metadata?.nome as string | undefined);

    const texto = item.type === 'lead_received'
      ? mensagemLead(nome)
      : `Olá, ${nome ?? 'tudo bem'}! Sou do time OLI Health Hub. Vi que você ${item.type === 'new_signup' ? 'acabou de se cadastrar' : 'contratou um novo módulo'} e gostaria de ajudar com qualquer dúvida.`;

    // Onde mora o telefone depende do tipo:
    //   lead_received       → metadata.whatsapp (a única fonte que existe)
    //   new_signup / módulo → profiles.whatsapp (o metadata NUNCA teve
    //                         telefone — 0 de 109 `new_signup` têm a chave)
    // O código antigo lia só `metadata.phone`, chave inexistente em qualquer
    // registro. Por isso o botão sempre caía no link genérico e abria a tela
    // de escolher contato em vez da conversa.
    const numero = (item.metadata?.whatsapp as string | undefined)
      ?? item.profiles?.whatsapp
      ?? (item.metadata?.phone as string | undefined)
      ?? null;

    abrirWhatsApp(numero, texto);
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-oli-border flex flex-col items-center justify-center py-16 text-oli-lgray text-sm gap-2">
        <span className="text-3xl">✅</span>
        Fila vazia — nenhum item pendente!
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {SECOES.map(secao => {
        const itensSecao = items.filter(i => secao.tipos.includes(i.type));
        if (itensSecao.length === 0) return null;
        return (
          <div key={secao.titulo}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <h2 className="text-xs font-bold text-oli-lgray uppercase tracking-wide">{secao.titulo}</h2>
              <span className="text-[10px] font-bold text-oli-lgray bg-gray-100 rounded-full px-1.5 py-0.5">{itensSecao.length}</span>
            </div>
            <div className="bg-white rounded-2xl border border-oli-border divide-y divide-oli-border overflow-hidden">
              {itensSecao.map(item => {
                const tag = TYPE_TAG[item.type] ?? { label: item.type, color: 'bg-gray-50 text-gray-600' };
                const origem = item.type === 'lead_received' ? (item.metadata?.origem as string | undefined) : undefined;
                const origemTag = origem ? ORIGEM_TAG[origem] : undefined;
                return (
                  <div key={item.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-semibold text-oli-dark text-sm">
                          {item.profiles?.nome ?? (item.metadata?.nome as string | undefined) ?? item.title}
                        </p>
                        <p className="text-xs text-oli-gray mt-0.5">{item.body}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${origemTag?.color ?? tag.color}`}>
                          {origemTag?.label ?? tag.label}
                        </span>
                        <span className="text-[10px] text-oli-lgray">{timeAgo(item.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {item.type === 'whatsapp_message_received' && item.metadata?.conversation_id ? (
                        <Link
                          href={`/conversas?id=${String(item.metadata.conversation_id)}`}
                          className="bg-oli-green text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Ver conversa
                        </Link>
                      ) : (
                        <button
                          onClick={() => openWhatsApp(item)}
                          className="bg-[#25D366] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                        >
                          WhatsApp
                        </button>
                      )}
                      <button
                        onClick={() => dismiss(item.id)}
                        className="border border-oli-border text-oli-gray text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors"
                      >
                        Dispensar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
