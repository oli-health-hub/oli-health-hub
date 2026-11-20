import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { Sprout, Crown, CheckCircle2, PauseCircle, ShieldAlert, Ban, Calculator, Scale, HeartPulse, Megaphone, Layers, Mail, ChevronDown, ExternalLink, type LucideIcon } from 'lucide-react';
import PainelFiltros, { type CampoPainel, type SecaoPainel, type IconePainel, type TomPainel } from '@/components/PainelFiltros';

export const dynamic = 'force-dynamic';

const PLAN_COLOR: Record<string, string> = {
  START: 'bg-blue-50 text-blue-600',
  BASE:  'bg-gray-100 text-gray-600',
  PRO:   'bg-oli-gold/15 text-oli-gold',
  VIP:   'bg-yellow-50 text-yellow-700',
};

const STATUS_BADGE: Record<string, { label: string; color: string; Icone: LucideIcon; icone: IconePainel; tom: TomPainel }> = {
  active:    { label: 'Ativa',     color: 'bg-green-50 text-oli-green',   Icone: CheckCircle2, icone: 'ativa',    tom: 'green'  },
  paused:    { label: 'Pausada',   color: 'bg-amber-50 text-amber-700',   Icone: PauseCircle,  icone: 'pausada',  tom: 'amber'  },
  suspended: { label: 'Suspensa',  color: 'bg-orange-50 text-orange-700', Icone: ShieldAlert,  icone: 'suspensa', tom: 'orange' },
  banned:    { label: 'Banida',    color: 'bg-red-50 text-oli-red',       Icone: Ban,          icone: 'banida',   tom: 'red'    },
};

const PLAN_VISUAL: Record<string, { Icone: LucideIcon; icone: IconePainel; tom: TomPainel }> = {
  START: { Icone: Sprout, icone: 'start', tom: 'blue' },
  PRO:   { Icone: Crown,  icone: 'pro',   tom: 'gold' },
};

// Assessorias OLI — usadas pra identificar gaps de upsell por médico.
const ASSESSORIAS: { key: string; full: string; Icone: LucideIcon }[] = [
  { key: 'contabilidade', full: 'Contabilidade', Icone: Calculator },
  { key: 'juridica',      full: 'Jurídica',      Icone: Scale },
  { key: 'convenios',     full: 'Convênios',     Icone: HeartPulse },
  { key: 'marketing',     full: 'Marketing',     Icone: Megaphone },
];

export default async function MedicosPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = await createSupabaseServer();

  const { data: medicosData } = await supabase
    .from('profiles')
    .select('id, nome, email, crm, especialidade, plan, created_at, assessorias_atuais, account_status')
    .not('user_type', 'in', '(admin,founder,specialist,partner,pending,team)')
    .neq('account_status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(200);
  const todos = medicosData ?? [];

  const { count: excluidosCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .not('user_type', 'in', '(admin,founder,specialist,partner,pending,team)')
    .eq('account_status', 'deleted');

  // Conta módulos ativos por profissional
  const professionalIds = todos.map(m => m.id);
  const { data: moduleCounts } = professionalIds.length > 0
    ? await supabase
        .from('user_modules')
        .select('professional_id')
        .in('professional_id', professionalIds)
        .eq('status', 'active')
    : { data: [] };

  const moduleCountMap: Record<string, number> = {};
  (moduleCounts ?? []).forEach(m => {
    moduleCountMap[m.professional_id] = (moduleCountMap[m.professional_id] ?? 0) + 1;
  });

  // Filtro em memória (a base é pequena), com contadores que respeitam os outros filtros.
  // Fallback no START, não no BASE: o BASE está desativado desde 19/ago e o cadastro voltou
  // a nascer no START em 26/ago, então perfil sem plano é sobra antiga, não plano intermediário.
  const planoDe = (m: (typeof todos)[number]) => m.plan ?? 'START';
  const statusDe = (m: (typeof todos)[number]) => m.account_status ?? 'active';
  const espDe = (m: (typeof todos)[number]) => m.especialidade?.trim() || 'sem';

  const fPlano = searchParams.plano ?? 'todos';
  const fStatus = searchParams.status ?? 'todos';
  const fEsp = searchParams.especialidade ?? 'todos';
  const busca = (searchParams.q ?? '').trim();
  const termo = busca.toLowerCase();

  const bate = (m: (typeof todos)[number], excluir?: 'plano' | 'status' | 'especialidade'): boolean => {
    if (termo && !`${m.nome ?? ''} ${m.email ?? ''} ${m.crm ?? ''}`.toLowerCase().includes(termo)) return false;
    if (excluir !== 'plano' && fPlano !== 'todos' && planoDe(m) !== fPlano) return false;
    if (excluir !== 'status' && fStatus !== 'todos' && statusDe(m) !== fStatus) return false;
    if (excluir !== 'especialidade' && fEsp !== 'todos' && espDe(m) !== fEsp) return false;
    return true;
  };
  const medicos = todos.filter(m => bate(m));

  const contar = (base: typeof todos, chave: (m: (typeof todos)[number]) => string) =>
    base.reduce<Record<string, number>>((acc, m) => {
      const k = chave(m);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const cPlano = contar(todos.filter(m => bate(m, 'plano')), planoDe);
  const cStatus = contar(todos.filter(m => bate(m, 'status')), statusDe);
  const cEsp = contar(todos.filter(m => bate(m, 'especialidade')), espDe);

  const planos = Array.from(new Set([...todos.map(planoDe), ...(fPlano !== 'todos' ? [fPlano] : [])]))
    .sort((a, b) => (a === 'START' ? -1 : b === 'START' ? 1 : a.localeCompare(b)));

  const chipsPlano: CampoPainel = {
    nome: 'plano', rotulo: 'Plano', atual: fPlano, todos: 'Todos', tipo: 'chips',
    opcoes: planos.map(p => ({
      valor: p, label: p, n: cPlano[p] ?? 0,
      icone: PLAN_VISUAL[p]?.icone, tom: PLAN_VISUAL[p]?.tom ?? 'gray',
    })),
  };
  const chipsStatus: CampoPainel = {
    nome: 'status', rotulo: 'Status', atual: fStatus, todos: 'Todos', tipo: 'chips',
    opcoes: Object.entries(STATUS_BADGE)
      .map(([valor, b]) => ({ valor, label: b.label, n: cStatus[valor] ?? 0, icone: b.icone, tom: b.tom }))
      .filter(o => o.valor === 'active' || o.n > 0 || o.valor === fStatus),
  };
  const selectEspecialidade: CampoPainel = {
    nome: 'especialidade', rotulo: 'Especialidade', atual: fEsp, todos: 'Todas as especialidades', tipo: 'select',
    opcoes: Object.entries(cEsp)
      .map(([valor, n]) => ({ valor, label: valor === 'sem' ? 'Sem especialidade' : valor, n }))
      .concat(fEsp !== 'todos' && !cEsp[fEsp] ? [{ valor: fEsp, label: fEsp, n: 0 }] : [])
      .sort((a, b) => (a.valor === 'sem' ? 1 : b.valor === 'sem' ? -1 : a.label.localeCompare(b.label, 'pt-BR'))),
  };
  const secoes: SecaoPainel[] = [
    { titulo: 'Assinatura', campos: [chipsPlano] },
    { titulo: 'Situação da conta', campos: [chipsStatus] },
    { titulo: 'Perfil profissional', campos: [selectEspecialidade] },
  ];

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-4 md:p-7">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-oli-dark">Profissionais</h1>
        <div className="flex items-center gap-4">
          {!!excluidosCount && (
            <Link href="/medicos/excluidos" className="text-sm text-oli-lgray underline transition-colors hover:text-oli-dark">
              {excluidosCount} excluída{excluidosCount !== 1 ? 's' : ''} →
            </Link>
          )}
          <span className="text-sm text-oli-gray">{todos.length} cadastrados</span>
        </div>
      </header>

      <PainelFiltros
        basePath="/medicos"
        secoes={secoes}
        busca={busca}
        placeholderBusca="Buscar por nome, e-mail ou CRM…"
        rotuloItens="profissionais"
        total={medicos.length}
        totalGeral={todos.length}
      />

      {medicos.length === 0 ? (
        <p className="rounded-2xl border border-oli-border bg-white px-4 py-10 text-center text-sm text-oli-lgray">
          {todos.length === 0 ? 'Nenhum médico cadastrado ainda' : 'Nenhum profissional com esses filtros.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {medicos.map(m => {
            const plan        = planoDe(m);
            const planColor   = PLAN_COLOR[plan] ?? 'bg-gray-100 text-gray-600';
            const PlanIcone   = PLAN_VISUAL[plan]?.Icone;
            const moduleCount = moduleCountMap[m.id] ?? 0;
            const date        = new Date(m.created_at).toLocaleDateString('pt-BR');
            const tem         = new Set(m.assessorias_atuais ?? []);
            const statusBadge = STATUS_BADGE[statusDe(m)] ?? STATUS_BADGE.active;
            const StatusIcone = statusBadge.Icone;
            const nome        = m.nome ?? '—';
            return (
              <li key={m.id} className="relative rounded-2xl border border-oli-border bg-white">
                <details className="group">
                  <summary
                    aria-label={`Ver detalhes de ${nome}`}
                    className="flex cursor-pointer list-none items-center gap-3 rounded-2xl py-2.5 pl-3 pr-12 transition-colors duration-150 hover:bg-oli-bg/50 [&::-webkit-details-marker]:hidden"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oli-green/15 text-sm font-bold text-oli-green"
                      aria-hidden="true"
                    >
                      {(m.nome?.trim().charAt(0) || '?').toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-oli-dark">{nome}</span>
                      <span className="block truncate text-xs text-oli-gray">
                        {[m.especialidade, m.crm && `CRM ${m.crm}`].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${planColor}`}>
                        {PlanIcone && <PlanIcone className="h-3 w-3" aria-hidden="true" />}
                        {plan}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge.color}`}>
                        <StatusIcone className="h-3 w-3" aria-hidden="true" />
                        {statusBadge.label}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-oli-lgray transition-transform duration-150 ease-out group-open:rotate-180" aria-hidden="true" />
                  </summary>

                  <div className="space-y-3 border-t border-oli-border/70 bg-oli-bg/40 px-4 py-3 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${planColor}`}>
                        {PlanIcone && <PlanIcone className="h-3 w-3" aria-hidden="true" />}
                        {plan}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge.color}`}>
                        <StatusIcone className="h-3 w-3" aria-hidden="true" />
                        {statusBadge.label}
                      </span>
                    </div>
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
                      <div className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-oli-lgray">E-mail</dt>
                        <dd className="flex items-center gap-1 text-oli-dark"><Mail className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{m.email ?? '—'}</span></dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-oli-lgray">Módulos</dt>
                        <dd className="flex items-center gap-1 text-oli-dark">
                          <Layers className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {moduleCount > 0 ? <span className="font-semibold text-oli-green">{moduleCount} ativo{moduleCount !== 1 ? 's' : ''}</span> : <span className="text-oli-lgray">Nenhum</span>}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-oli-lgray">Cadastro</dt>
                        <dd className="text-oli-dark">{date}</dd>
                      </div>
                    </dl>
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-oli-lgray">Assessorias</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ASSESSORIAS.map(a => {
                          const has = tem.has(a.key);
                          return (
                            <span
                              key={a.key}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                                has ? 'bg-oli-green/10 text-oli-green' : 'border border-dashed border-oli-border text-oli-lgray'
                              }`}
                            >
                              <a.Icone className="h-3 w-3" aria-hidden="true" />
                              {a.full}
                              <span className="sr-only">{has ? ': já possui' : ': não possui'}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </details>
                <Link
                  href={`/medicos/${m.id}`}
                  aria-label={`Abrir a ficha de ${nome}`}
                  title="Abrir ficha"
                  className="absolute right-2 top-[30px] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-oli-green transition-transform duration-150 ease-out hover:bg-oli-green/10 active:scale-95"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
