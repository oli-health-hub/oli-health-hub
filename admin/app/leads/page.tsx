import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { updateLead } from '@/app/actions';

export const dynamic = 'force-dynamic';

interface Lead {
  id:            string;
  created_at:    string;
  nome:          string;
  whatsapp:      string | null;   // opcional: lead de Google Ads via RD vem só com e-mail
  email:         string;
  fonte:         string | null;
  especialidade: string | null;
  origem:        string;
  status:        string;
  observacoes:     string | null;
  conjunto:        string | null;
  anuncio:         string | null;
  temperatura:     string | null;
  perfil:          string | null;
  motivo_descarte: string | null;
}

const ORIGEM_LABEL: Record<string, string> = {
  site:       'Site',
  rd_station: 'RD Station',
  meta_ads:   'Meta Ads',
  whatsapp:  'WhatsApp',
  indicacao: 'Indicação',
  evento:    'Evento',
  outro:     'Outro',
};

/* Ordem = ordem da esteira. O `select` do formulário lê daqui, então mexer aqui
   muda a ordem na tela também. */
const STATUS_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  novo:               { label: 'Novo',                bg: 'bg-blue-50',   text: 'text-blue-600'   },
  contatado:          { label: 'Contatado',           bg: 'bg-yellow-50', text: 'text-yellow-700' },
  sem_resposta:       { label: 'Não consegui falar',  bg: 'bg-orange-50', text: 'text-orange-700' },
  aguardando_retorno: { label: 'Aguardando retorno',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
  visita_agendada:    { label: 'Visita agendada',     bg: 'bg-purple-50', text: 'text-purple-600' },
  visita_realizada:   { label: 'Visita realizada',    bg: 'bg-indigo-50', text: 'text-indigo-600' },
  proposta_enviada:   { label: 'Proposta enviada',    bg: 'bg-teal-50',   text: 'text-teal-700'   },
  convertido:         { label: 'Convertido',          bg: 'bg-green-50',  text: 'text-oli-green'  },
  descartado:         { label: 'Descartado',          bg: 'bg-gray-100',  text: 'text-gray-400'   },
};

const TEMPERATURA_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  quente: { label: '🔥 Quente', bg: 'bg-red-50',    text: 'text-red-600'  },
  morno:  { label: 'Morno',     bg: 'bg-orange-50', text: 'text-orange-600' },
  frio:   { label: 'Frio',      bg: 'bg-sky-50',    text: 'text-sky-600'  },
};

const PERFIL_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  dentro:      { label: 'Dentro do perfil', bg: 'bg-green-50', text: 'text-oli-green' },
  fora:        { label: 'Fora do perfil',   bg: 'bg-gray-100', text: 'text-gray-500'  },
  a_confirmar: { label: 'Perfil a confirmar', bg: 'bg-yellow-50', text: 'text-yellow-700' },
};

const MOTIVO_LABEL: Record<string, string> = {
  mora_longe:       'Mora longe demais',
  achou_caro:       'Achou caro',
  sem_perfil:       'Não tem perfil',
  contato_invalido: 'Contato não funciona',
  sumiu:            'Sumiu / parou de responder',
  sem_interesse:    'Sem interesse',
};

function formatData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = await createSupabaseAdmin();
  const { data } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  const todos = (data ?? []) as Lead[];

  // Filtro em memória, não no banco: a base é pequena (dezenas) e assim os
  // contadores de cada situação saem da mesma consulta, sem 9 queries de count.
  const filtro = searchParams.status ?? 'todos';
  const leads  = filtro === 'todos' ? todos : todos.filter(l => l.status === filtro);

  const contagem = todos.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  // Mais largo que o max-w-6xl das outras telas de propósito: esta tem 7 colunas.
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-oli-dark">Leads</h1>
        <p className="text-sm text-gray-500">Contatos do site, dos anúncios e da RD Station.</p>
      </div>

      {/* Filtro por situação. Links, não botões: mantém a página como server
          component e deixa cada filtro com URL própria, compartilhável. */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/leads"
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            filtro === 'todos'
              ? 'bg-oli-green text-white border-oli-green'
              : 'bg-white text-gray-500 border-gray-200 hover:border-oli-green'
          }`}
        >
          Todos <span className="opacity-70">{todos.length}</span>
        </Link>

        {Object.entries(STATUS_LABEL).map(([valor, meta]) => {
          const n = contagem[valor] ?? 0;
          // Etapa sem nenhum lead não vira chip — a barra ficaria com 9 filtros
          // mortos desde o primeiro dia.
          if (n === 0 && filtro !== valor) return null;
          const ativo = filtro === valor;
          return (
            <Link
              key={valor}
              href={`/leads?status=${valor}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                ativo
                  ? 'bg-oli-green text-white border-oli-green'
                  : `${meta.bg} ${meta.text} border-transparent hover:border-oli-green`
              }`}
            >
              {meta.label} <span className="opacity-70">{n}</span>
            </Link>
          );
        })}
      </div>

      {/* overflow-x-auto, não overflow-hidden: em tela menor a coluna de edição
          empurra a tabela além do container e o hidden cortava conteúdo sem dar
          como rolar. */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Recebido</th>
              <th className="text-left px-4 py-3">Contato</th>
              <th className="text-left px-4 py-3">Especialidade</th>
              <th className="text-left px-4 py-3">Origem</th>
              <th className="text-left px-4 py-3">Situação</th>
              <th className="text-left px-4 py-3 w-[330px]">Atualizar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                {filtro === 'todos'
                  ? 'Nenhum lead recebido ainda.'
                  : 'Nenhum lead nesta situação.'}
              </td></tr>
            )}
            {leads.map((lead) => {
              const statusMeta = STATUS_LABEL[lead.status] ?? { label: lead.status, bg: 'bg-gray-100', text: 'text-gray-500' };
              const tempMeta   = lead.temperatura ? TEMPERATURA_LABEL[lead.temperatura] : null;
              const perfilMeta = lead.perfil      ? PERFIL_LABEL[lead.perfil]           : null;
              return (
                <tr key={lead.id} className="border-t border-gray-50 align-top">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatData(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-oli-dark">{lead.nome}</p>
                    {lead.whatsapp
                      ? <p className="text-xs text-gray-400">{lead.whatsapp}</p>
                      : <p className="text-xs text-amber-600 font-medium">sem telefone — falar por e-mail</p>}
                    <p className="text-xs text-gray-400">{lead.email}</p>
                  </td>
                  <td className="px-4 py-3">{lead.especialidade ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p>{ORIGEM_LABEL[lead.origem] ?? lead.origem}</p>
                    {/* fonte vem da RD (canal), conjunto/anuncio vêm do Meta (criativo).
                        São camadas diferentes — por isso aparecem juntas, sem substituição. */}
                    {lead.fonte && <p className="text-xs text-oli-green font-medium">{lead.fonte}</p>}
                    {lead.conjunto && <p className="text-xs text-gray-400">{lead.conjunto}</p>}
                    {lead.anuncio && <p className="text-xs text-gray-400">{lead.anuncio}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusMeta.bg} ${statusMeta.text}`}>
                        {statusMeta.label}
                      </span>
                      {tempMeta && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${tempMeta.bg} ${tempMeta.text}`}>
                          {tempMeta.label}
                        </span>
                      )}
                      {perfilMeta && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${perfilMeta.bg} ${perfilMeta.text}`}>
                          {perfilMeta.label}
                        </span>
                      )}
                      {lead.motivo_descarte && (
                        <span className="text-xs text-gray-400">
                          {MOTIVO_LABEL[lead.motivo_descarte] ?? lead.motivo_descarte}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 w-[330px]">
                    <form action={updateLead} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={lead.id} />

                      <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold -mb-1">Etapa</label>
                      <select name="status" defaultValue={lead.status} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        {Object.entries(STATUS_LABEL).map(([value, meta]) => (
                          <option key={value} value={value}>{meta.label}</option>
                        ))}
                      </select>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Temperatura</label>
                          <select name="temperatura" defaultValue={lead.temperatura ?? ''} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                            <option value="">— não avaliado</option>
                            {Object.entries(TEMPERATURA_LABEL).map(([value, meta]) => (
                              <option key={value} value={value}>{meta.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Perfil</label>
                          <select name="perfil" defaultValue={lead.perfil ?? ''} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                            <option value="">— não avaliado</option>
                            {Object.entries(PERFIL_LABEL).map(([value, meta]) => (
                              <option key={value} value={value}>{meta.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Sempre visível: esconder condicionalmente exigiria virar client
                          component só por isso. O banco recusa motivo em lead que não
                          está descartado, e a action limpa o campo antes de gravar. */}
                      <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold -mb-1">
                        Motivo <span className="normal-case tracking-normal font-normal">(só vale se descartado)</span>
                      </label>
                      <select name="motivo_descarte" defaultValue={lead.motivo_descarte ?? ''} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        <option value="">— sem motivo</option>
                        {Object.entries(MOTIVO_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>

                      {/* Colapsado por padrão: a maioria dos leads não tem observação,
                          e um textarea de 8 linhas em toda linha da tabela deixava a
                          tela impossível de varrer. O <details> é nativo — não precisa
                          virar client component só pra abrir e fechar.
                          O textarea continua no DOM fechado, então o form envia normal. */}
                      <details className="group">
                        <summary className="cursor-pointer list-none text-[11px] text-gray-500 hover:text-oli-green">
                          {lead.observacoes ? (
                            <>
                              <span className="font-semibold uppercase tracking-wide text-gray-400">Obs. </span>
                              <span className="group-open:hidden">
                                {lead.observacoes.slice(0, 60)}{lead.observacoes.length > 60 ? '…' : ''}
                              </span>
                              <span className="hidden group-open:inline text-oli-green font-semibold">fechar</span>
                            </>
                          ) : (
                            <span className="text-gray-400 group-open:text-oli-green">+ observação</span>
                          )}
                        </summary>
                        <textarea
                          name="observacoes"
                          defaultValue={lead.observacoes ?? ''}
                          placeholder="Observações internas"
                          rows={6}
                          className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] leading-relaxed resize-y"
                        />
                      </details>
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
