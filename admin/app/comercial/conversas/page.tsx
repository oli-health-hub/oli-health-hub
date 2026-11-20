import { createSupabaseAdmin } from '@/lib/supabase-server';
import { MessageCircle } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui';
import ConversasClient from './ConversasClient';

export const dynamic = 'force-dynamic';

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = await createSupabaseAdmin();

  const { data: conversas } = await supabase
    .from('conversations')
    .select(`
      id, kind, status, phone_e164, last_message_at, last_inbound_at,
      last_message_direction, admin_last_read_at,
      lead_id, patient_id, professional_id,
      leads:lead_id ( nome, status, temperatura, origem ),
      patients:patient_id ( nome ),
      profiles:professional_id ( nome )
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200);

  return (
    <div className="flex h-full flex-col p-3 md:p-6">
      <div className="mb-3 shrink-0">
        <CabecalhoPagina
          titulo="Conversas"
          icone={MessageCircle}
          subtitulo={
            <span className="hidden md:inline">
              WhatsApp — número único da OLI. Leads (recrutamento) respondidos por IA dentro do escopo; pacientes sempre atendidos pela recepção.
            </span>
          }
        />
      </div>
      <div className="min-h-0 flex-1">
        <ConversasClient initial={(conversas ?? []) as never[]} initialId={searchParams.id ?? null} />
      </div>
    </div>
  );
}
