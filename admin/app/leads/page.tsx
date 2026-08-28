import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { updateLead, optInLeadWhatsapp, pauseLeadWhatsappNutricao, resumeLeadWhatsappNutricao } from '@/app/actions';
import BotaoWhatsApp from '@/components/BotaoWhatsApp';
import { mensagemLead } from '@/lib/whatsapp';

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
  rd_deal_id:      string | null;
  rd_sync_erro:    string | null;
  atendente_id:    string | null;
  canal_primeiro_contato: string | null;
  whatsapp_opt_in_at:     string | null;
  whatsapp_opt_in_source: string | null;
  whatsapp_opt_out_at:    string | null;
}

interface Atendente {
  id:   string;
  nome: string;
}

interface EtapaNutricao {
  lead_id:       string;
  etapa:         string;
  status:        string;
  data_prevista: string;
  enviado_em:    string | null;
}

/** Primeiro nome + inicial do sobrenome: "Claudia M.". Na tabela, nome
 *  completo empurraria as outras colunas sem acrescentar informação. */
function nomeCurto(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return p.length === 1 ? p[0] : `${p[0]} ${p[1][0]}.`;
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
  engano_numero:    'Errou o número',
};

/* Canal usado pela equipe pra ABORDAR o lead — eixo diferente de origem/fonte,
   que é de onde o lead VEIO. Um lead do site pode ser abordado por ligação. */
const CANAL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  ligacao:  'Ligação',
  email:    'E-mail',
};

/* Régua de nutrição comercial (docs/WHATSAPP_NUTRICAO_COMERCIAL.md). Origem
   do opt-in — de onde veio o consentimento pra falar por WhatsApp, não de
   onde veio o lead (isso já é `origem`). */
const OPT_IN_SOURCE_LABEL: Record<string, string> = {
  formulario_rd:   'Formulário RD',
  formulario_site: 'Formulário do site',
  anuncio_meta:    'Anúncio Meta',
  manual:          'Registrado manualmente',
};

const ETAPA_NUTRICAO_LABEL: Record<string, string> = {
  primeiro_contato: 'Primeiro contato',
  d3:  'Retomada D+3',
  d10: 'Retomada D+10',
  d24: 'Retomada D+24',
  d45: 'Encerramento D+45',
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

  // A lista de atendentes sai de quem tem acesso ao painel — hoje Claudia, Igor
  // e Guilherme. Incluir alguém novo é conceder acesso, sem mexer no código.
  const { data: atendentesData } = await supabase
    .from('profiles').select('id, nome').eq('is_admin', true).order('nome');
  const atendentes = (atendentesData ?? []) as Atendente[];
  const nomePorId  = new Map(atendentes.map(a => [a.id, a.nome]));

  // Etapas da régua de nutrição, uma consulta à parte: a maioria dos leads
  // não tem nenhuma (sem opt-in), então não vale a pena carregar num join
  // sempre presente.
  const leadIds = todos.map(l => l.id);
  const { data: etapasData } = leadIds.length > 0
    ? await supabase.from('whatsapp_nutricao_etapas')
        .select('lead_id, etapa, status, data_prevista, enviado_em')
        .in('lead_id', leadIds)
    : { data: [] as EtapaNutricao[] };
  const etapasPorLead = new Map<string, EtapaNutricao[]>();
  for (const e of (etapasData ?? []) as EtapaNutricao[]) {
    const arr = etapasPorLead.get(e.lead_id) ?? [];
    arr.push(e);
    etapasPorLead.set(e.lead_id, arr);
  }

  /** Uma linha de resumo por lead: a próxima etapa agendada tem prioridade
   *  sobre o histórico — é o que importa pra saber se falta algo acontecer. */
  function resumoNutricao(lead: Lead): { label: string; bg: string; text: string } | null {
    if (!lead.whatsapp_opt_in_at) return null;
    if (lead.whatsapp_opt_out_at) return { label: 'Nutrição pausada', bg: 'bg-gray-100', text: 'text-gray-500' };

    const etapas = etapasPorLead.get(lead.id) ?? [];
    const agendada = etapas.find(e => e.status === 'agendada');
    if (agendada) {
      return {
        label: `Próxima: ${ETAPA_NUTRICAO_LABEL[agendada.etapa] ?? agendada.etapa} em ${formatData(agendada.data_prevista)}`,
        bg: 'bg-sky-50', text: 'text-sky-700',
      };
    }

    const ultima = [...etapas].sort((a, b) => (b.enviado_em ?? b.data_prevista).localeCompare(a.enviado_em ?? a.data_prevista))[0];
    if (!ultima) return { label: 'Opt-in registrado — sem etapa', bg: 'bg-gray-100', text: 'text-gray-400' };
    if (ultima.status === 'enviada' && ultima.etapa === 'd45') {
      return { label: 'Régua encerrada (D+45)', bg: 'bg-gray-100', text: 'text-gray-500' };
    }
    return {
      label: `${ETAPA_NUTRICAO_LABEL[ultima.etapa] ?? ultima.etapa}: ${ultima.status}`,
      bg: 'bg-amber-50', text: 'text-amber-700',
    };
  }

  // Filtro em memória, não no banco: a base é pequena (dezenas) e assim os
  // contadores saem da mesma consulta, sem uma query de count por opção.
  const filtro      = searchParams.status      ?? 'todos';
  const filtroAtd   = searchParams.atendente   ?? 'todos';
  const filtroOrig  = searchParams.origem      ?? 'todos';
  // Eixo macro (pendente/atendido) coexiste com a etapa detalhada de propósito:
  // "pendente" é só um atalho pra status==='novo', não substitui a esteira.
  const filtroAtend = searchParams.atendimento ?? 'todos';
  const buscaCrua   = (searchParams.q ?? '').trim().toLowerCase();

  const bate = (l: Lead, excluir?: 'status' | 'atendente' | 'origem' | 'atendimento'): boolean => {
    if (buscaCrua) {
      const alvo = `${l.nome} ${l.email ?? ''} ${l.whatsapp ?? ''}`.toLowerCase();
      if (!alvo.includes(buscaCrua)) return false;
    }
    if (excluir !== 'status' && filtro !== 'todos' && l.status !== filtro) return false;
    if (excluir !== 'origem' && filtroOrig !== 'todos' && l.origem !== filtroOrig) return false;
    if (excluir !== 'atendente' && filtroAtd !== 'todos') {
      const bateAtd = filtroAtd === 'sem' ? l.atendente_id === null : l.atendente_id === filtroAtd;
      if (!bateAtd) return false;
    }
    if (excluir !== 'atendimento' && filtroAtend !== 'todos') {
      const pendente = l.status === 'novo';
      if (filtroAtend === 'pendente' && !pendente) return false;
      if (filtroAtend === 'atendido' && pendente) return false;
    }
    return true;
  };

  const leads = todos.filter(l => bate(l));

  // Cada contador respeita todos os OUTROS filtros ativos, exceto o próprio
  // eixo — senão o número no chip não corresponde ao que aparece na tabela
  // depois de clicar.
  const baseStatus = todos.filter(l => bate(l, 'status'));
  const baseAtd    = todos.filter(l => bate(l, 'atendente'));
  const baseOrig   = todos.filter(l => bate(l, 'origem'));
  const baseAtend  = todos.filter(l => bate(l, 'atendimento'));

  const contagem = baseStatus.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  const contagemAtd = baseAtd.reduce<Record<string, number>>((acc, l) => {
    const k = l.atendente_id ?? 'sem';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const contagemOrig = baseOrig.reduce<Record<string, number>>((acc, l) => {
    acc[l.origem] = (acc[l.origem] ?? 0) + 1;
    return acc;
  }, {});

  const contagemAtend = baseAtend.reduce<Record<string, number>>((acc, l) => {
    const k = l.status === 'novo' ? 'pendente' : 'atendido';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  // Preserva os outros filtros ao montar cada link, senão clicar num chip
  // descarta silenciosamente as escolhas anteriores.
  const href = (p: { status?: string; atendente?: string; origem?: string; atendimento?: string; q?: string }) => {
    const query = new URLSearchParams();
    const s  = p.status      ?? filtro;
    const a  = p.atendente   ?? filtroAtd;
    const o  = p.origem      ?? filtroOrig;
    const at = p.atendimento ?? filtroAtend;
    const b  = p.q           ?? searchParams.q ?? '';
    if (s  !== 'todos') query.set('status', s);
    if (a  !== 'todos') query.set('atendente', a);
    if (o  !== 'todos') query.set('origem', o);
    if (at !== 'todos') query.set('atendimento', at);
    if (b)              query.set('q', b);
    const qs = query.toString();
    return qs ? `/leads?${qs}` : '/leads';
  };

  // Mais largo que o max-w-6xl das outras telas de propósito: esta tem 7 colunas.
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-oli-dark">Leads</h1>
        <p className="text-sm text-gray-500">Contatos do site, dos anúncios e da RD Station.</p>
      </div>

      {/* Busca livre. GET nativo, não client component: o navegador monta a
          URL sozinho e a página server component faz o resto — mesmo padrão
          dos chips abaixo. Campos ocultos preservam os outros filtros
          ativos, senão buscar reseta a situação/atendente/origem escolhidos. */}
      <form action="/leads" method="get" className="flex items-center gap-2">
        <input type="hidden" name="status" value={filtro} />
        <input type="hidden" name="atendente" value={filtroAtd} />
        <input type="hidden" name="origem" value={filtroOrig} />
        <input type="hidden" name="atendimento" value={filtroAtend} />
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Buscar por nome, e-mail ou WhatsApp…"
          className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" className="text-xs text-oli-green font-semibold underline">Buscar</button>
        {buscaCrua && (
          <Link href={href({ q: '' })} className="text-xs text-gray-400 hover:text-gray-600">limpar</Link>
        )}
      </form>

      {/* Filtro por situação. Links, não botões: mantém a página como server
          component e deixa cada filtro com URL própria, compartilhável. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold w-16">Atendimento</span>
          <Link
            href={href({ atendimento: 'todos' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtroAtend === 'todos'
                ? 'bg-oli-green text-white border-oli-green'
                : 'bg-white text-gray-500 border-gray-200 hover:border-oli-green'
            }`}
          >
            Todos <span className="opacity-70">{baseAtend.length}</span>
          </Link>
          <Link
            href={href({ atendimento: 'pendente' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtroAtend === 'pendente'
                ? 'bg-oli-green text-white border-oli-green'
                : 'bg-amber-50 text-amber-700 border-transparent hover:border-oli-green'
            }`}
          >
            Falta atender <span className="opacity-70">{contagemAtend['pendente'] ?? 0}</span>
          </Link>
          <Link
            href={href({ atendimento: 'atendido' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtroAtend === 'atendido'
                ? 'bg-oli-green text-white border-oli-green'
                : 'bg-green-50 text-oli-green border-transparent hover:border-oli-green'
            }`}
          >
            Já atendido <span className="opacity-70">{contagemAtend['atendido'] ?? 0}</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold w-16">Origem</span>
          <Link
            href={href({ origem: 'todos' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtroOrig === 'todos'
                ? 'bg-oli-green text-white border-oli-green'
                : 'bg-white text-gray-500 border-gray-200 hover:border-oli-green'
            }`}
          >
            Todas <span className="opacity-70">{baseOrig.length}</span>
          </Link>
          {Object.entries(ORIGEM_LABEL).map(([valor, label]) => {
            const n = contagemOrig[valor] ?? 0;
            if (n === 0 && filtroOrig !== valor) return null;
            const ativo = filtroOrig === valor;
            return (
              <Link
                key={valor}
                href={href({ origem: valor })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  ativo
                    ? 'bg-oli-green text-white border-oli-green'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-oli-green'
                }`}
              >
                {label} <span className="opacity-70">{n}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold w-16">Situação</span>
          <Link
            href={href({ status: 'todos' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtro === 'todos'
                ? 'bg-oli-green text-white border-oli-green'
                : 'bg-white text-gray-500 border-gray-200 hover:border-oli-green'
            }`}
          >
            Todas <span className="opacity-70">{baseStatus.length}</span>
          </Link>

          {Object.entries(STATUS_LABEL).map(([valor, meta]) => {
            const n = contagem[valor] ?? 0;
            // Etapa sem nenhum lead não vira chip — a barra ficaria com 9
            // filtros mortos desde o primeiro dia.
            if (n === 0 && filtro !== valor) return null;
            const ativo = filtro === valor;
            return (
              <Link
                key={valor}
                href={href({ status: valor })}
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold w-16">Atendente</span>
          <Link
            href={href({ atendente: 'todos' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtroAtd === 'todos'
                ? 'bg-oli-green text-white border-oli-green'
                : 'bg-white text-gray-500 border-gray-200 hover:border-oli-green'
            }`}
          >
            Todos <span className="opacity-70">{baseAtd.length}</span>
          </Link>

          {atendentes.map(a => {
            const n = contagemAtd[a.id] ?? 0;
            const ativo = filtroAtd === a.id;
            return (
              <Link
                key={a.id}
                href={href({ atendente: a.id })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  ativo
                    ? 'bg-oli-green text-white border-oli-green'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-oli-green'
                }`}
              >
                {nomeCurto(a.nome)} <span className="opacity-70">{n}</span>
              </Link>
            );
          })}

          {/* "Sem atendente" é o chip que mais importa no dia a dia: é a fila
              de quem ainda não tem dono. Aparece mesmo zerado, de propósito. */}
          <Link
            href={href({ atendente: 'sem' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtroAtd === 'sem'
                ? 'bg-oli-green text-white border-oli-green'
                : 'bg-amber-50 text-amber-700 border-transparent hover:border-oli-green'
            }`}
          >
            Sem atendente <span className="opacity-70">{contagemAtd['sem'] ?? 0}</span>
          </Link>
        </div>
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
                {filtro === 'todos' && filtroAtd === 'todos' && filtroOrig === 'todos' && filtroAtend === 'todos' && !buscaCrua
                  ? 'Nenhum lead recebido ainda.'
                  : 'Nenhum lead com esses filtros.'}
              </td></tr>
            )}
            {leads.map((lead) => {
              const statusMeta   = STATUS_LABEL[lead.status] ?? { label: lead.status, bg: 'bg-gray-100', text: 'text-gray-500' };
              const tempMeta     = lead.temperatura ? TEMPERATURA_LABEL[lead.temperatura] : null;
              const perfilMeta   = lead.perfil      ? PERFIL_LABEL[lead.perfil]           : null;
              const nutricaoMeta = resumoNutricao(lead);
              return (
                <tr key={lead.id} className="border-t border-gray-50 align-top">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatData(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-oli-dark">{lead.nome}</p>
                    {lead.whatsapp
                      ? <p className="text-xs text-gray-400">{lead.whatsapp}</p>
                      : <p className="text-xs text-amber-600 font-medium">sem telefone — falar por e-mail</p>}
                    <p className="text-xs text-gray-400">{lead.email}</p>
                    {/* O botão some sozinho quando não há número utilizável —
                        oferecer e abrir o WhatsApp sem destino pareceria defeito. */}
                    <div className="mt-1.5">
                      <BotaoWhatsApp numero={lead.whatsapp} texto={mensagemLead(lead.nome)} tamanho="pequeno" />
                    </div>
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
                      {/* Sem dono aparece em âmbar, não some: lead sem atendente
                          é o que mais corre risco de ficar parado. */}
                      {lead.atendente_id
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-gray-100 text-gray-600">
                            {nomeCurto(nomePorId.get(lead.atendente_id) ?? '—')}
                          </span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-amber-50 text-amber-700">
                            sem atendente
                          </span>}
                      {lead.canal_primeiro_contato && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-sky-50 text-sky-700">
                          1º contato: {CANAL_LABEL[lead.canal_primeiro_contato] ?? lead.canal_primeiro_contato}
                        </span>
                      )}
                      {/* Régua de nutrição comercial — só aparece com opt-in
                          registrado. Sem isso, não existe disparo automático. */}
                      {nutricaoMeta && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${nutricaoMeta.bg} ${nutricaoMeta.text}`}>
                          {nutricaoMeta.label}
                        </span>
                      )}
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
                      {/* Só aparece quando algo deu errado. Sem este aviso, um lead
                          dessincronizado da RD ficaria invisível — que é justamente
                          o problema que a sincronização existe para evitar. */}
                      {lead.rd_sync_erro && (
                        <span className="text-xs text-oli-red font-semibold" title={lead.rd_sync_erro}>
                          ⚠ não espelhado na RD
                        </span>
                      )}
                      {!lead.rd_deal_id && (
                        <span className="text-xs text-gray-400">sem negociação na RD</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 w-[330px]">
                    <form action={updateLead} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={lead.id} />

                      <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold -mb-1">Atendente</label>
                      <select name="atendente_id" defaultValue={lead.atendente_id ?? ''} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        <option value="">— sem atendente</option>
                        {atendentes.map(a => (
                          <option key={a.id} value={a.id}>{a.nome}</option>
                        ))}
                      </select>

                      <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold -mb-1">Etapa</label>
                      <select name="status" defaultValue={lead.status} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        {Object.entries(STATUS_LABEL).map(([value, meta]) => (
                          <option key={value} value={value}>{meta.label}</option>
                        ))}
                      </select>

                      <label className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold -mb-1">1º contato foi por</label>
                      <select name="canal_primeiro_contato" defaultValue={lead.canal_primeiro_contato ?? ''} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        <option value="">— não registrado</option>
                        {Object.entries(CANAL_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
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

                    {/* Formulário à parte — HTML não aceita <form> aninhado.
                        Régua de nutrição comercial: inerte até os 5 templates
                        estarem aprovados na Meta (ver whatsapp_templates). */}
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      {!lead.whatsapp_opt_in_at ? (
                        <form action={optInLeadWhatsapp} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={lead.id} />
                          <select name="source" defaultValue="" required className="border border-gray-200 rounded-lg px-1.5 py-1 text-[11px] flex-1">
                            <option value="" disabled>Opt-in WhatsApp por…</option>
                            {Object.entries(OPT_IN_SOURCE_LABEL).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                          <button type="submit" className="text-[11px] text-oli-green font-semibold underline whitespace-nowrap">
                            Registrar
                          </button>
                        </form>
                      ) : lead.whatsapp_opt_out_at ? (
                        <form action={resumeLeadWhatsappNutricao}>
                          <input type="hidden" name="id" value={lead.id} />
                          <button type="submit" className="text-[11px] text-oli-green font-semibold underline">
                            Retomar nutrição
                          </button>
                        </form>
                      ) : (
                        <form action={pauseLeadWhatsappNutricao}>
                          <input type="hidden" name="id" value={lead.id} />
                          <button type="submit" className="text-[11px] text-gray-500 font-semibold underline">
                            Pausar nutrição
                          </button>
                        </form>
                      )}
                    </div>
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
