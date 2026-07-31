import { createSupabaseAdmin } from '@/lib/supabase-server';
import { updateLead } from '@/app/actions';

export const dynamic = 'force-dynamic';

interface Lead {
  id:            string;
  created_at:    string;
  nome:          string;
  whatsapp:      string;
  email:         string;
  especialidade: string | null;
  origem:        string;
  status:        string;
  observacoes:   string | null;
}

const ORIGEM_LABEL: Record<string, string> = {
  site:      'Site',
  whatsapp:  'WhatsApp',
  indicacao: 'Indicação',
  evento:    'Evento',
  outro:     'Outro',
};

const STATUS_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  novo:            { label: 'Novo',            bg: 'bg-blue-50',   text: 'text-blue-600'  },
  contatado:       { label: 'Contatado',       bg: 'bg-yellow-50', text: 'text-yellow-700' },
  visita_agendada: { label: 'Visita agendada', bg: 'bg-purple-50', text: 'text-purple-600' },
  convertido:      { label: 'Convertido',      bg: 'bg-green-50',  text: 'text-oli-green'  },
  descartado:      { label: 'Descartado',      bg: 'bg-gray-100',  text: 'text-gray-400'   },
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default async function LeadsPage() {
  const supabase = await createSupabaseAdmin();
  const { data } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  const leads = (data ?? []) as Lead[];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-oli-dark">Leads</h1>
        <p className="text-sm text-gray-500">Contatos recebidos pelo formulário do site institucional.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Recebido</th>
              <th className="text-left px-4 py-3">Contato</th>
              <th className="text-left px-4 py-3">Especialidade</th>
              <th className="text-left px-4 py-3">Origem</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Observações</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Nenhum lead recebido ainda.</td></tr>
            )}
            {leads.map((lead) => {
              const statusMeta = STATUS_LABEL[lead.status] ?? { label: lead.status, bg: 'bg-gray-100', text: 'text-gray-500' };
              return (
                <tr key={lead.id} className="border-t border-gray-50 align-top">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatData(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-oli-dark">{lead.nome}</p>
                    <p className="text-xs text-gray-400">{lead.whatsapp}</p>
                    <p className="text-xs text-gray-400">{lead.email}</p>
                  </td>
                  <td className="px-4 py-3">{lead.especialidade ?? '—'}</td>
                  <td className="px-4 py-3">{ORIGEM_LABEL[lead.origem] ?? lead.origem}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusMeta.bg} ${statusMeta.text}`}>
                      {statusMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-[200px]">
                    <form action={updateLead} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={lead.id} />
                      <select name="status" defaultValue={lead.status} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        {Object.entries(STATUS_LABEL).map(([value, meta]) => (
                          <option key={value} value={value}>{meta.label}</option>
                        ))}
                      </select>
                      <textarea
                        name="observacoes"
                        defaultValue={lead.observacoes ?? ''}
                        placeholder="Observações internas"
                        rows={2}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs resize-none"
                      />
                      <button type="submit" className="text-xs text-oli-green font-semibold underline self-start">
                        Salvar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
