import { createSupabaseAdmin } from '@/lib/supabase-server';
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
      lead_id, patient_id, professional_id,
      leads:lead_id ( nome ),
      patients:patient_id ( nome ),
      profiles:professional_id ( nome )
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200);

  return (
    <div className="p-7 h-[calc(100vh-2rem)]">
      <h1 className="text-2xl font-bold text-oli-dark mb-1">Conversas</h1>
      <p className="text-sm text-oli-lgray mb-5">
        WhatsApp — número único da OLI. Leads (recrutamento) respondidos por IA dentro do escopo; pacientes sempre atendidos pela recepção.
      </p>
      <ConversasClient initial={(conversas ?? []) as never[]} initialId={searchParams.id ?? null} />
    </div>
  );
}
