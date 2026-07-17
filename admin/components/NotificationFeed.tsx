'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-client';

type NotifType = 'new_signup' | 'module_purchased' | 'module_activated' | 'plan_subscribed' | 'plan_activated' | 'reservation_created';

interface Notification {
  id:              string;
  type:            NotifType;
  title:           string;
  body:            string | null;
  metadata:        Record<string, unknown>;
  read_at:         string | null;
  created_at:      string;
  professional_id: string | null;
}

const TYPE_META: Record<NotifType, { icon: string; bg: string; label: string }> = {
  new_signup:       { icon: '👤', bg: 'bg-green-50',  label: 'Novo cadastro'   },
  module_purchased: { icon: '📦', bg: 'bg-yellow-50', label: 'Módulo contratado' },
  module_activated: { icon: '✅', bg: 'bg-yellow-50', label: 'Módulo ativado'  },
  plan_subscribed:  { icon: '⭐', bg: 'bg-blue-50',   label: 'Plano contratado' },
  plan_activated:   { icon: '🏆', bg: 'bg-blue-50',   label: 'Plano ativado'   },
  reservation_created: { icon: '📅', bg: 'bg-green-50', label: 'Nova reserva' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function NotificationFeed() {
  const [items,   setItems]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await getSupabaseBrowser()
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as Notification[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    // Realtime: escuta novos inserts
    const channel = getSupabaseBrowser()
      .channel('admin_notifications_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          setItems(prev => [payload.new as Notification, ...prev].slice(0, 50));
        })
      .subscribe();

    return () => { getSupabaseBrowser().removeChannel(channel); };
  }, [load]);

  async function markRead(id: string) {
    await getSupabaseBrowser()
      .from('admin_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-oli-lgray text-sm">
        Carregando...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-oli-lgray text-sm">
        Nenhuma notificação ainda
      </div>
    );
  }

  return (
    <div className="divide-y divide-oli-border overflow-y-auto max-h-[480px]">
      {items.map(n => {
        const meta    = TYPE_META[n.type] ?? { icon: '📌', bg: 'bg-gray-50', label: n.type };
        const unread  = !n.read_at;
        return (
          <div
            key={n.id}
            onClick={() => unread && markRead(n.id)}
            className={`flex gap-3 px-5 py-4 cursor-pointer transition-colors ${unread ? 'hover:bg-stone-50' : 'opacity-60 hover:bg-stone-50'}`}
          >
            <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-base ${meta.bg}`}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-oli-dark leading-snug truncate-1">{n.title}</p>
              {n.body && <p className="text-xs text-oli-gray mt-0.5 truncate-1">{n.body}</p>}
              <p className="text-[10px] text-oli-lgray mt-1">{timeAgo(n.created_at)}</p>
            </div>
            {unread && (
              <div className="w-2 h-2 rounded-full bg-oli-green flex-shrink-0 mt-1.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}
