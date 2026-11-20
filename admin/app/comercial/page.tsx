import { ChevronDown, Users, Clock, Flame, UserX } from 'lucide-react';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { updateLead, optInLeadWhatsapp, pauseLeadWhatsappNutricao, resumeLeadWhatsappNutricao } from '@/app/actions';
import BotaoWhatsApp from '@/components/BotaoWhatsApp';
import { ORIGEM_LABEL, STATUS_LABEL, TEMPERATURA_LABEL } from '@/lib/lead-labels';
import PainelFiltros, { type CampoPainel, type SecaoPainel } from '@/components/PainelFiltros';
import { mensagemLead } from '@/lib/whatsapp';
import { CabecalhoPagina, type KpiDef } from '@/components/ui';

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
  atendido_por_ia: boolean;
  canal_primeiro_contato: string | null;
  whatsapp_opt_in_at:     string | null;
  whatsapp_opt_in_source: string | null;
  whatsapp_opt_out_at:    string | null;
  revisita_status:    string | null;
  revisita_em:        string | null;
  revisita_por:       string | null;
  revisita_resultado: string | null;
  lote:               string | null;
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

const PERFIL_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  dentro:      { label: 'Dentro do perfil', bg: 'bg-green-50', text: 'text-oli-green' },
  fora:        { label: 'Fora do perfil',   bg: 'bg-gray-100', text: 'text-gray-500'  },
  a_confirmar: { label: 'Perfil a confirmar', bg: 'bg-yellow-50', text: 'text-yellow-700' },
};

/* Revisita da base herdada: varredura manual da Claudia por WhatsApp antes da
   troca de agência. Eixo separado da esteira (`status`) de propósito — um lead
   pode estar 'contatado' na esteira e ainda não ter sido revisitado. `null` =
   fora da fila (descartados e quem já tem visita agendada). */
const REVISITA_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  pendente:     { label: 'Revisitar',        bg: 'bg-rose-50',   text: 'text-rose-700'   },
  em_andamento: { label: 'Revisita em curso', bg: 'bg-amber-50',  text: 'text-amber-700'  },
  respondeu:    { label: 'Respondeu',        bg: 'bg-green-50',  text: 'text-oli-green'  },
  sem_retorno:  { label: 'Sem retorno',      bg: 'bg-orange-50', text: 'text-orange-700' },
  encerrado:    { label: 'Revisita encerrada', bg: 'bg-gray-100', text: 'text-gray-500'  },
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

const ETAPA_NUTRICAO_LABEL: Record<string, string> = {
  primeiro_contato: 'Primeiro contato',
  d3:  'Retomada D+3',
  d10: 'Retomada D+10',
  d24: 'Retomada D+24',
  d45: 'Encerramento D+45',
};

/* De onde o lead veio já diz de onde veio o consentimento, na maioria dos
   casos — evita obrigar quem está clicando a escolher numa lista toda vez.
   Origem sem mapeamento cai em 'manual', que é sempre uma opção válida. */
const ORIGEM_PARA_OPT_IN_SOURCE: Record<string, string> = {
  rd_station: 'formulario_rd',
  site:       'formulario_site',
  meta_ads:   'anuncio_meta',
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
  // Temperatura/perfil viraram filtro próprio depois da classificação em massa
  // dos leads de WhatsApp (29/ago) — sem isso, "quem eu ligo primeiro" ficava
  // só visível vasculhando badge por badge na tabela inteira.
  const filtroTemp   = searchParams.temperatura ?? 'todos';
  const filtroPerfil = searchParams.perfil      ?? 'todos';
  // Fila da revisita pré-troca de agência. 'fora' é balde próprio: descartados e
  // visitas já agendadas ficaram de fora da varredura e não deveriam sumir do
  // painel só por isso.
  const filtroRev    = searchParams.revisita    ?? 'todos';
  const buscaCrua   = (searchParams.q ?? '').trim().toLowerCase();

  const bate = (l: Lead, excluir?: 'status' | 'atendente' | 'origem' | 'atendimento' | 'temperatura' | 'perfil' | 'revisita'): boolean => {
    if (buscaCrua) {
      const alvo = `${l.nome} ${l.email ?? ''} ${l.whatsapp ?? ''}`.toLowerCase();
      if (!alvo.includes(buscaCrua)) return false;
    }
    if (excluir !== 'status' && filtro !== 'todos' && l.status !== filtro) return false;
    if (excluir !== 'origem' && filtroOrig !== 'todos' && l.origem !== filtroOrig) return false;
    if (excluir !== 'atendente' && filtroAtd !== 'todos') {
      // Olivia é seu próprio balde, tem prioridade sobre atendente_id/sem —
      // um lead que ela contatou não some do balde "sem atendente" nem
      // aparece contado em dobro num atendente humano.
      const bucket = l.atendido_por_ia ? 'olivia' : (l.atendente_id ?? 'sem');
      if (bucket !== filtroAtd) return false;
    }
    if (excluir !== 'atendimento' && filtroAtend !== 'todos') {
      const pendente = l.status === 'novo';
      if (filtroAtend === 'pendente' && !pendente) return false;
      if (filtroAtend === 'atendido' && pendente) return false;
    }
    if (excluir !== 'temperatura' && filtroTemp !== 'todos') {
      const bucket = l.temperatura ?? 'sem';
      if (bucket !== filtroTemp) return false;
    }
    if (excluir !== 'perfil' && filtroPerfil !== 'todos') {
      const bucket = l.perfil ?? 'sem';
      if (bucket !== filtroPerfil) return false;
    }
    if (excluir !== 'revisita' && filtroRev !== 'todos') {
      const bucket = l.revisita_status ?? 'fora';
      if (bucket !== filtroRev) return false;
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
  const baseTemp   = todos.filter(l => bate(l, 'temperatura'));
  const basePerfil = todos.filter(l => bate(l, 'perfil'));
  const baseRev    = todos.filter(l => bate(l, 'revisita'));

  const contagem = baseStatus.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  const contagemAtd = baseAtd.reduce<Record<string, number>>((acc, l) => {
    const k = l.atendido_por_ia ? 'olivia' : (l.atendente_id ?? 'sem');
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

  const contagemTemp = baseTemp.reduce<Record<string, number>>((acc, l) => {
    const k = l.temperatura ?? 'sem';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const contagemPerfil = basePerfil.reduce<Record<string, number>>((acc, l) => {
    const k = l.perfil ?? 'sem';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const contagemRev = baseRev.reduce<Record<string, number>>((acc, l) => {
    const k = l.revisita_status ?? 'fora';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const campo = (c: Omit<CampoPainel, 'tipo'>): CampoPainel => ({ ...c, tipo: 'select' });
  const secoes: SecaoPainel[] = [
    {
      titulo: 'Fila de trabalho',
      campos: [
        campo({
          nome: 'atendimento', rotulo: 'Atendimento', atual: filtroAtend, todos: `Todos (${baseAtend.length})`,
          opcoes: [
            { valor: 'pendente', label: 'Falta atender', n: contagemAtend['pendente'] ?? 0 },
            { valor: 'atendido', label: 'Já atendido', n: contagemAtend['atendido'] ?? 0 },
          ],
        }),
        campo({
          nome: 'revisita', rotulo: 'Revisita', atual: filtroRev, todos: `Todas (${baseRev.length})`,
          opcoes: [
            ...Object.entries(REVISITA_LABEL).map(([valor, m]) => ({ valor, label: m.label, n: contagemRev[valor] ?? 0 })),
            { valor: 'fora', label: 'Fora da varredura', n: contagemRev['fora'] ?? 0 },
          ].filter(o => o.n > 0 || o.valor === filtroRev),
        }),
        // Olivia não é um profile com acesso ao painel — é a IA da régua comercial, mas conta como
        // atendente. "Sem atendente" é a fila de quem não tem dono e aparece mesmo zerada, de propósito.
        campo({
          nome: 'atendente', rotulo: 'Atendente', atual: filtroAtd, todos: `Todos (${baseAtd.length})`,
          opcoes: [
            { valor: 'olivia', label: 'Olivia (IA)', n: contagemAtd['olivia'] ?? 0 },
            ...atendentes.map(a => ({ valor: a.id, label: nomeCurto(a.nome), n: contagemAtd[a.id] ?? 0 })),
            { valor: 'sem', label: 'Sem atendente', n: contagemAtd['sem'] ?? 0 },
          ],
        }),
      ],
    },
    {
      titulo: 'Qualificação',
      campos: [
        campo({
          nome: 'status', rotulo: 'Situação', atual: filtro, todos: `Todas (${baseStatus.length})`,
          opcoes: Object.entries(STATUS_LABEL)
            .map(([valor, m]) => ({ valor, label: m.label, n: contagem[valor] ?? 0 }))
            .filter(o => o.n > 0 || o.valor === filtro),
        }),
        campo({
          nome: 'temperatura', rotulo: 'Temperatura', atual: filtroTemp, todos: `Todas (${baseTemp.length})`,
          opcoes: [
            ...Object.entries(TEMPERATURA_LABEL).map(([valor, m]) => ({ valor, label: m.label.replace('🔥 ', ''), n: contagemTemp[valor] ?? 0 })),
            { valor: 'sem', label: 'Sem avaliação', n: contagemTemp['sem'] ?? 0 },
          ].filter(o => o.n > 0 || o.valor === filtroTemp),
        }),
        campo({
          nome: 'perfil', rotulo: 'Perfil', atual: filtroPerfil, todos: `Todos (${basePerfil.length})`,
          opcoes: [
            ...Object.entries(PERFIL_LABEL).map(([valor, m]) => ({ valor, label: m.label, n: contagemPerfil[valor] ?? 0 })),
            { valor: 'sem', label: 'Sem avaliação', n: contagemPerfil['sem'] ?? 0 },
          ].filter(o => o.n > 0 || o.valor === filtroPerfil),
        }),
      ],
    },
    {
      titulo: 'Origem',
      campos: [
        campo({
          nome: 'origem', rotulo: 'Origem', atual: filtroOrig, todos: `Todas (${baseOrig.length})`,
          opcoes: Object.entries(ORIGEM_LABEL)
            .map(([valor, label]) => ({ valor, label, n: contagemOrig[valor] ?? 0 }))
            .filter(o => o.n > 0 || o.valor === filtroOrig),
        }),
      ],
    },
  ];

  const CAMPO = 'h-8 w-full rounded-lg border border-oli-border bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-oli-green/30';
  const ROTULO = 'text-[10px] font-bold uppercase tracking-wide text-oli-lgray';
  const SELO = 'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold';
  const BARRA_TEMP: Record<string, string> = { quente: 'bg-oli-red', morno: 'bg-orange-400', frio: 'bg-sky-400' };

  // Indicadores sobre todos os leads, não sobre o resultado filtrado.
  const kpisLeads: KpiDef[] = [
    { icone: Users, rotulo: 'Total de leads', valor: String(todos.length), tom: 'green' },
    { icone: Clock, rotulo: 'Falta atender', valor: String(todos.filter(l => l.status === 'novo').length), tom: 'amber' },
    { icone: Flame, rotulo: 'Quentes', valor: String(todos.filter(l => l.temperatura === 'quente').length), tom: 'red' },
    { icone: UserX, rotulo: 'Sem atendente', valor: String(todos.filter(l => !l.atendente_id && !l.atendido_por_ia).length), tom: 'neutral' },
  ];

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 md:p-6">
      <CabecalhoPagina
        titulo="Leads"
        subtitulo="Contatos do site, dos anúncios e da RD Station."
        icone={Users}
        kpis={kpisLeads}
      />

      <PainelFiltros
        basePath="/comercial"
        secoes={secoes}
        busca={searchParams.q ?? ''}
        placeholderBusca="Buscar por nome, e-mail ou WhatsApp…"
        rotuloItens="leads"
        total={leads.length}
        totalGeral={todos.length}
      />

      {leads.length === 0 ? (
        <p className="rounded-2xl border border-oli-border bg-white px-4 py-8 text-center text-sm text-oli-gray">
          {filtro === 'todos' && filtroAtd === 'todos' && filtroOrig === 'todos' && filtroAtend === 'todos' && !buscaCrua
            ? 'Nenhum lead recebido ainda.'
            : 'Nenhum lead com esses filtros.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => {
            const statusMeta   = STATUS_LABEL[lead.status] ?? { label: lead.status, bg: 'bg-gray-100', text: 'text-gray-500' };
            const tempMeta     = lead.temperatura ? TEMPERATURA_LABEL[lead.temperatura] : null;
            const perfilMeta   = lead.perfil      ? PERFIL_LABEL[lead.perfil]           : null;
            const nutricaoMeta = resumoNutricao(lead);
            const revMeta      = lead.revisita_status ? REVISITA_LABEL[lead.revisita_status] : null;
            const barra        = (lead.temperatura && BARRA_TEMP[lead.temperatura]) || 'bg-oli-border';
            return (
              <li key={lead.id} className="relative overflow-hidden rounded-2xl border border-oli-border bg-white">
                <span className={`absolute inset-y-0 left-0 w-1.5 ${barra}`} aria-hidden="true" />
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 pl-5 pr-4">
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-sm font-bold text-oli-dark">{lead.nome}</p>
                      <span className={`${SELO} ${statusMeta.bg} ${statusMeta.text}`}>{statusMeta.label}</span>
                      {tempMeta && <span className={`${SELO} ${tempMeta.bg} ${tempMeta.text}`}>{tempMeta.label}</span>}
                      {revMeta && <span className={`${SELO} ${revMeta.bg} ${revMeta.text}`}>{revMeta.label}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-oli-gray">
                      {[
                        lead.especialidade,
                        ORIGEM_LABEL[lead.origem] ?? lead.origem,
                        lead.whatsapp ?? 'sem telefone',
                        formatData(lead.created_at),
                      ].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {lead.atendido_por_ia
                        ? <span className={`${SELO} bg-blue-50 text-blue-700`}>Olivia (IA)</span>
                        : lead.atendente_id
                          ? <span className={`${SELO} bg-gray-100 text-gray-600`}>{nomeCurto(nomePorId.get(lead.atendente_id) ?? '—')}</span>
                          : <span className={`${SELO} bg-amber-50 text-amber-700`}>Sem atendente</span>}
                      {nutricaoMeta && <span className={`${SELO} ${nutricaoMeta.bg} ${nutricaoMeta.text}`}>{nutricaoMeta.label}</span>}
                      {lead.rd_sync_erro && (
                        <span className="text-[11px] font-semibold text-oli-red" title={lead.rd_sync_erro}>⚠ não espelhado na RD</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <BotaoWhatsApp numero={lead.whatsapp} texto={mensagemLead(lead.nome)} tamanho="pequeno" />
                    {/* Só aparece antes do opt-in; depois disso pausar/retomar vive nos detalhes. */}
                    {lead.whatsapp && !lead.whatsapp_opt_in_at && (
                      <form action={optInLeadWhatsapp}>
                        <input type="hidden" name="id" value={lead.id} />
                        <input type="hidden" name="source" value={ORIGEM_PARA_OPT_IN_SOURCE[lead.origem] ?? 'manual'} />
                        <button
                          type="submit"
                          className="rounded-lg bg-oli-green px-2 py-0.5 text-[11px] font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
                        >
                          Iniciar com Olivia
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                <details className="group border-t border-oli-border/70 bg-oli-bg/40">
                  <summary
                    aria-label={`Detalhes e edição de ${lead.nome}`}
                    className="flex cursor-pointer list-none items-center gap-1.5 py-2 pl-5 pr-4 text-xs font-semibold text-oli-green [&::-webkit-details-marker]:hidden"
                  >
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-open:rotate-180" aria-hidden="true" />
                    <span className="group-open:hidden">Detalhes e edição</span>
                    <span className="hidden group-open:inline">Fechar detalhes</span>
                  </summary>

                  <div className="space-y-3 px-5 pb-4 pt-1">
                    <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                      <div><dt className={ROTULO}>E-mail</dt><dd className="break-all text-oli-dark">{lead.email}</dd></div>
                      {lead.fonte && <div><dt className={ROTULO}>Fonte (RD)</dt><dd className="text-oli-green font-medium">{lead.fonte}</dd></div>}
                      {lead.conjunto && <div><dt className={ROTULO}>Conjunto</dt><dd className="text-oli-dark">{lead.conjunto}</dd></div>}
                      {lead.anuncio && <div><dt className={ROTULO}>Anúncio</dt><dd className="text-oli-dark">{lead.anuncio}</dd></div>}
                      {(perfilMeta || lead.canal_primeiro_contato || lead.motivo_descarte) && (
                        <div className="sm:col-span-2">
                          <dt className={ROTULO}>Perfil e contato</dt>
                          <dd className="text-oli-gray">
                            {[
                              perfilMeta?.label,
                              lead.canal_primeiro_contato && `1º contato: ${CANAL_LABEL[lead.canal_primeiro_contato] ?? lead.canal_primeiro_contato}`,
                              lead.motivo_descarte && (MOTIVO_LABEL[lead.motivo_descarte] ?? lead.motivo_descarte),
                            ].filter(Boolean).join(' · ')}
                          </dd>
                        </div>
                      )}
                      {lead.revisita_em && (
                        <div className="sm:col-span-2">
                          <dt className={ROTULO}>Revisita</dt>
                          <dd className="text-oli-gray">
                            {formatData(lead.revisita_em)}
                            {lead.revisita_por && ` · ${nomeCurto(nomePorId.get(lead.revisita_por) ?? '—')}`}
                            {lead.revisita_resultado && ` · ${lead.revisita_resultado}`}
                          </dd>
                        </div>
                      )}
                      {!lead.rd_deal_id && <div className="sm:col-span-2 text-oli-lgray">Sem negociação na RD</div>}
                    </dl>

                    <form action={updateLead} className="space-y-3 rounded-xl border border-oli-border bg-white p-3">
                      <input type="hidden" name="id" value={lead.id} />
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>Atendente</span>
                          <select name="atendente_id" defaultValue={lead.atendente_id ?? ''} className={CAMPO}>
                            <option value="">— sem atendente</option>
                            {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>Etapa</span>
                          <select name="status" defaultValue={lead.status} className={CAMPO}>
                            {Object.entries(STATUS_LABEL).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>1º contato foi por</span>
                          <select name="canal_primeiro_contato" defaultValue={lead.canal_primeiro_contato ?? ''} className={CAMPO}>
                            <option value="">— não registrado</option>
                            {Object.entries(CANAL_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>Temperatura</span>
                          <select name="temperatura" defaultValue={lead.temperatura ?? ''} className={CAMPO}>
                            <option value="">— não avaliado</option>
                            {Object.entries(TEMPERATURA_LABEL).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>Perfil</span>
                          <select name="perfil" defaultValue={lead.perfil ?? ''} className={CAMPO}>
                            <option value="">— não avaliado</option>
                            {Object.entries(PERFIL_LABEL).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                          </select>
                        </label>
                        {/* Sempre visível: o banco recusa motivo em lead que não está descartado
                            e a action limpa o campo antes de gravar. */}
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>Motivo (só vale se descartado)</span>
                          <select name="motivo_descarte" defaultValue={lead.motivo_descarte ?? ''} className={CAMPO}>
                            <option value="">— sem motivo</option>
                            {Object.entries(MOTIVO_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                      </div>

                      {/* Eixo paralelo à esteira: a esteira diz onde o lead está, a revisita diz se
                          já passamos por ele nesta rodada. "— fora da varredura" tira o lead da fila. */}
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>Revisita</span>
                          <select name="revisita_status" defaultValue={lead.revisita_status ?? ''} className={CAMPO}>
                            <option value="">— fora da varredura</option>
                            {Object.entries(REVISITA_LABEL).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>Quem revisitou</span>
                          <select name="revisita_por" defaultValue={lead.revisita_por ?? ''} className={CAMPO}>
                            <option value="">— não registrado</option>
                            {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                          </select>
                        </label>
                        {/* Separado de `observacoes`: aquele guarda o histórico da agência anterior. */}
                        <label className="flex flex-col gap-1">
                          <span className={ROTULO}>Resposta na revisita</span>
                          <input
                            type="text"
                            name="revisita_resultado"
                            defaultValue={lead.revisita_resultado ?? ''}
                            placeholder="O que ele respondeu"
                            className={CAMPO}
                          />
                        </label>
                      </div>

                      <label className="flex flex-col gap-1">
                        <span className={ROTULO}>Observações internas</span>
                        <textarea
                          name="observacoes"
                          defaultValue={lead.observacoes ?? ''}
                          placeholder="Observações internas"
                          rows={4}
                          className="w-full resize-y rounded-lg border border-oli-border px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-oli-green/30"
                        />
                      </label>

                      <button
                        type="submit"
                        className="h-9 rounded-xl bg-oli-green px-4 text-xs font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
                      >
                        Salvar
                      </button>
                    </form>

                    {/* Formulário à parte — HTML não aceita <form> aninhado. */}
                    {lead.whatsapp_opt_in_at && (
                      lead.whatsapp_opt_out_at ? (
                        <form action={resumeLeadWhatsappNutricao}>
                          <input type="hidden" name="id" value={lead.id} />
                          <button type="submit" className="text-xs font-semibold text-oli-green underline">Retomar nutrição</button>
                        </form>
                      ) : (
                        <form action={pauseLeadWhatsappNutricao}>
                          <input type="hidden" name="id" value={lead.id} />
                          <button type="submit" className="text-xs font-semibold text-oli-gray underline">Pausar nutrição</button>
                        </form>
                      )
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
