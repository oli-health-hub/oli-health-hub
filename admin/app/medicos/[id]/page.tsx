import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase-server';
import { changePlan, addHours } from '@/app/actions';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// ── Label maps ──────────────────────────────��───────────────────────────────

const SITUACAO_JURIDICA: Record<string, string> = {
  pf:    'Pessoa Física (autônomo)',
  pj:    'Pessoa Jurídica',
  ambos: 'PF + PJ (ambos)',
};
const LOCAL_ATUACAO: Record<string, string> = {
  proprio:   'Espaço próprio',
  terceiros: 'Espaços de terceiros',
  ambos:     'Próprio + terceiros',
};
const NUM_LOCAIS: Record<string, string> = {
  '1':    '1 local',
  '2_3':  '2 a 3 locais',
  '4_6':  '4 a 6 locais',
  'mais_6': 'Mais de 6 locais',
};
const FATURAMENTO: Record<string, string> = {
  'ate_10k':    'Até R$ 10.000 / mês',
  '10k_30k':    'R$ 10.001 – R$ 30.000 / mês',
  '30k_80k':    'R$ 30.001 – R$ 80.000 / mês',
  '80k_160k':   'R$ 80.001 – R$ 160.000 / mês',
  'acima_160k': 'Acima de R$ 160.000 / mês',
};
const NOTAS_FISCAIS: Record<string, string> = {
  'nao_emite': 'Não emite',
  'ate_5':     'Até 5 / mês',
  '6_20':      '6 a 20 / mês',
  '21_50':     '21 a 50 / mês',
  'acima_50':  'Mais de 50 / mês',
};
const COMO_CONHECEU: Record<string, string> = {
  membro_oli:    'Indicação de membro OLI',
  amigo:         'Indicação de amigo',
  evento:        'Evento OLI',
  redes_sociais: 'Redes sociais',
  busca_internet:'Busca na internet',
  outro:         'Outro',
};
const PLAN_COLOR: Record<string, string> = {
  START: 'bg-blue-50 text-blue-600',
  BASE:  'bg-gray-100 text-gray-600',
  PRO:   'bg-green-50 text-oli-green',
  VIP:   'bg-yellow-50 text-yellow-700',
};
const STATUS_COLOR: Record<string, string> = {
  active:          'bg-green-50 text-oli-green',
  pending_payment: 'bg-yellow-50 text-yellow-700',
  cancelled:       'bg-red-50 text-oli-red',
  inactive:        'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  active:          'Ativo',
  pending_payment: 'Pendente',
  cancelled:       'Cancelado',
  inactive:        'Inativo',
  confirmed:       'Confirmada',
  completed:       'Concluída',
  no_show:         'No-show',
};

function fmt(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
function brl(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
function yn(val: boolean | null | undefined) {
  if (val === null || val === undefined) return '—';
  return val ? 'Sim' : 'Não';
}
function label<T extends string>(map: Record<string, string>, val: T | null | undefined) {
  if (!val) return '—';
  return map[val] ?? val;
}

// ── Small layout helpers ───────���────────────────────��─────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-oli-border p-5">
      <h3 className="text-sm font-bold text-oli-dark mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label: l, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-oli-border/60 last:border-0">
      <span className="text-xs text-oli-lgray w-44 shrink-0 pt-0.5">{l}</span>
      <span className="text-sm text-oli-dark flex-1">{value ?? '—'}</span>
    </div>
  );
}

// ── Page ─────────────────��────────────────────��───────────────────────────────

export default async function MedicoDetailPage({ params }: { params: { id: string } }) {
  const supabase      = await createSupabaseServer();
  const supabaseAdmin = await createSupabaseAdmin();

  // Perfil completo
  const { data: p } = await supabase
    .from('profiles')
    .select(`
      id, nome, crm, especialidade, plan, plan_id, bio, foto_url,
      consultation_duration_minutes, created_at, onboarding_complete, user_type,
      situacao_juridica, faturamento_range, atividade_exercida, possui_clt,
      local_atuacao, num_locais, cidade_uf, notas_fiscais_range,
      possui_funcionarios, previsao_contratacao, possui_socios, pre_paid_ok,
      tipos_atendimento, convenios, como_conheceu, referido_por
    `)
    .eq('id', params.id)
    .single();

  if (!p || p.user_type === 'admin') return notFound();

  // E-mail do auth
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(params.id);
  const email = authUser?.user?.email ?? null;
  const emailConfirmed = authUser?.user?.email_confirmed_at;
  const lastSignIn     = authUser?.user?.last_sign_in_at;

  // Indicador por
  let referidoPorNome: string | null = null;
  if (p.referido_por) {
    const { data: ref } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', p.referido_por)
      .single();
    referidoPorNome = ref?.nome ?? null;
  }

  // Assinaturas
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, ciclo, starts_at, ends_at, cancelled_at, created_at, plans(name, preco_mensal, preco_anual)')
    .eq('professional_id', params.id)
    .order('created_at', { ascending: false });

  // Módulos
  const { data: userModules } = await supabase
    .from('user_modules')
    .select('id, status, activated_at, ativo_ate, created_at, contract_url, modules(nome, valor, categoria, tipo)')
    .eq('professional_id', params.id)
    .order('created_at', { ascending: false });

  // Saldo de horas
  const { data: balances } = await supabase
    .from('hour_balance')
    .select('id, minutos_total, minutos_usados, expira_em, created_at')
    .eq('professional_id', params.id)
    .order('created_at', { ascending: false });

  // Sessões recentes (usage_charges)
  const { data: sessions } = await supabase
    .from('usage_charges')
    .select('id, iniciado_em, encerrado_em, minutos, valor_total, tipo_cobranca, reservation_id')
    .eq('professional_id', params.id)
    .order('iniciado_em', { ascending: false })
    .limit(20);

  // Reservas recentes
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, room_name, start_time, end_time, status, arrived_at')
    .eq('professional_id', params.id)
    .order('start_time', { ascending: false })
    .limit(20);

  // NPS
  const { data: npsResponses } = await supabase
    .from('nps_responses')
    .select('score, comment, context, created_at')
    .eq('professional_id', params.id)
    .order('created_at', { ascending: false });

  // Pacientes (só contagem — sem expor dados)
  const { count: patientCount } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('professional_id', params.id);

  // Planos disponíveis para trocar
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, preco_mensal, preco_anual')
    .eq('ativo', true)
    .order('preco_mensal', { ascending: true });

  // Saldo total de horas
  const totalMin  = (balances ?? []).reduce((s, b) => s + b.minutos_total, 0);
  const usadoMin  = (balances ?? []).reduce((s, b) => s + b.minutos_usados, 0);
  const restante  = totalMin - usadoMin;

  // NPS médio
  const npsScores = (npsResponses ?? []).map(n => n.score);
  const npsMedia  = npsScores.length > 0 ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1) : null;

  // Receita total (usage_charges)
  const receitaTotal = (sessions ?? []).reduce((s, c) => s + (c.valor_total ?? 0), 0);

  return (
    <div className="p-7 space-y-6 max-w-6xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-oli-lgray">
        <Link href="/medicos" className="hover:text-oli-green transition-colors">Médicos</Link>
        <span>/</span>
        <span className="text-oli-dark font-medium">{p.nome}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-oli-border p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-oli-green flex items-center justify-center text-white font-bold text-2xl shrink-0">
              {p.nome?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-oli-dark">{p.nome}</h1>
              <p className="text-sm text-oli-gray mt-0.5">
                {[p.especialidade, p.crm ? `CRM ${p.crm}` : null].filter(Boolean).join(' · ')}
              </p>
              {email && (
                <p className="text-sm text-oli-lgray mt-0.5">{email}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_COLOR[p.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.plan}
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.onboarding_complete ? 'bg-green-50 text-oli-green' : 'bg-yellow-50 text-yellow-700'}`}>
                  {p.onboarding_complete ? 'Onboarding completo' : 'Onboarding pendente'}
                </span>
                {p.pre_paid_ok && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                    Pré-pago OK
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* KPIs rápidos */}
          <div className="flex gap-6 text-center shrink-0">
            <div>
              <p className="text-2xl font-bold text-oli-dark">{fmt(restante)}</p>
              <p className="text-xs text-oli-lgray mt-0.5">Saldo de horas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-oli-dark">{patientCount ?? 0}</p>
              <p className="text-xs text-oli-lgray mt-0.5">Pacientes</p>
            </div>
            {npsMedia && (
              <div>
                <p className={`text-2xl font-bold ${Number(npsMedia) >= 8 ? 'text-oli-green' : Number(npsMedia) >= 6 ? 'text-yellow-600' : 'text-oli-red'}`}>
                  {npsMedia}
                </p>
                <p className="text-xs text-oli-lgray mt-0.5">NPS médio</p>
              </div>
            )}
            <div>
              <p className="text-2xl font-bold text-oli-dark">{brl(receitaTotal)}</p>
              <p className="text-xs text-oli-lgray mt-0.5">Receita total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Coluna esquerda: ações ── */}
        <div className="space-y-4">

          {/* Acesso */}
          <Section title="Acesso">
            <div className="space-y-0">
              <Field label="E-mail" value={email} />
              <Field label="E-mail confirmado" value={yn(!!emailConfirmed)} />
              <Field label="Último acesso" value={lastSignIn ? new Date(lastSignIn).toLocaleString('pt-BR') : '—'} />
              <Field label="Cadastrado em" value={new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} />
            </div>
          </Section>

          {/* Trocar plano */}
          <Section title="Alterar plano">
            <p className="text-xs text-oli-lgray mb-3">
              Plano atual: <span className="font-semibold text-oli-dark">{p.plan}</span>
            </p>
            <form action={changePlan} className="space-y-3">
              <input type="hidden" name="professional_id" value={p.id} />
              <select
                name="plan_id"
                required
                className="w-full text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark bg-white focus:outline-none focus:ring-1 focus:ring-oli-green"
              >
                <option value="">Selecionar plano…</option>
                {(plans ?? []).map(pl => (
                  <option key={pl.id} value={pl.id} data-name={pl.name}>
                    {pl.name} — R$ {Number(pl.preco_mensal).toFixed(2).replace('.', ',')}/mês
                  </option>
                ))}
              </select>
              <input type="hidden" name="plan_name" id={`pn_${p.id}`} value="" />
              <script dangerouslySetInnerHTML={{ __html: `
                (function(){
                  var sel = document.querySelector('select[name="plan_id"]');
                  var inp = document.getElementById('pn_${p.id}');
                  if(sel && inp) sel.addEventListener('change', function(){ inp.value = sel.options[sel.selectedIndex].dataset.name || ''; });
                })();
              `}} />
              <button type="submit" className="w-full text-sm font-semibold px-4 py-2 rounded-xl bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
                Salvar plano
              </button>
            </form>
          </Section>

          {/* Adicionar horas */}
          <Section title="Adicionar horas">
            <p className="text-xs text-oli-lgray mb-3">
              Saldo: <span className="font-semibold text-oli-dark">{fmt(restante)}</span>
              {' · '}Total comprado: <span className="font-semibold text-oli-dark">{fmt(totalMin)}</span>
            </p>
            <form action={addHours} className="space-y-3">
              <input type="hidden" name="professional_id" value={p.id} />
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  name="horas"
                  min="1"
                  step="1"
                  placeholder="Ex: 10"
                  required
                  title="Venda somente em horas inteiras (mín. 1h)"
                  className="flex-1 text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
                />
                <span className="text-xs text-oli-lgray shrink-0">horas inteiras</span>
              </div>
              <p className="text-[10px] text-oli-lgray">Mín. 1h · excedente cobrado em blocos de 30min</p>
              <button type="submit" className="w-full text-sm font-semibold px-4 py-2 rounded-xl bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
                + Adicionar
              </button>
            </form>
          </Section>

        </div>

        {/* ── Coluna direita: dados ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Dados profissionais */}
          <Section title="Dados profissionais">
            <Field label="Nome completo"       value={p.nome} />
            <Field label="Especialidade"       value={p.especialidade} />
            <Field label="CRM"                 value={p.crm} />
            <Field label="Duração consulta"    value={p.consultation_duration_minutes ? `${p.consultation_duration_minutes} min` : null} />
            {p.bio && <Field label="Bio"        value={p.bio} />}
            {(p.tipos_atendimento as string[] | null)?.length ? (
              <Field label="Tipos de atendimento" value={(p.tipos_atendimento as string[]).join(', ')} />
            ) : null}
            {(p.convenios as string[] | null)?.length ? (
              <Field label="Convênios" value={(p.convenios as string[]).join(', ')} />
            ) : null}
          </Section>

          {/* Ficha cadastral — onboarding fiscal */}
          <Section title="Ficha cadastral (fiscal)">
            <Field label="Situação jur��dica"     value={label(SITUACAO_JURIDICA, p.situacao_juridica)} />
            <Field label="Possui CLT?"            value={yn(p.possui_clt)} />
            <Field label="Possui sócios?"         value={yn(p.possui_socios)} />
            <Field label="Atividade exercida"     value={p.atividade_exercida} />
            <Field label="Local de atuação"       value={label(LOCAL_ATUACAO, p.local_atuacao)} />
            <Field label="Nº de locais"           value={label(NUM_LOCAIS, p.num_locais)} />
            <Field label="Cidade / UF"            value={p.cidade_uf} />
            <Field label="Faturamento mensal"     value={label(FATURAMENTO, p.faturamento_range)} />
            <Field label="Notas fiscais / mês"    value={label(NOTAS_FISCAIS, p.notas_fiscais_range)} />
            <Field label="Possui funcionários?"   value={yn(p.possui_funcionarios)} />
            {p.possui_funcionarios === false && (
              <Field label="Previsão de contratação?" value={yn(p.previsao_contratacao)} />
            )}
          </Section>

          {/* Como conheceu */}
          <Section title="Aquisição">
            <Field label="Como conheceu OLI" value={label(COMO_CONHECEU, p.como_conheceu)} />
            {referidoPorNome && (
              <Field label="Indicado por" value={
                <Link href={`/medicos/${p.referido_por}`} className="text-oli-green hover:underline">
                  {referidoPorNome}
                </Link>
              } />
            )}
          </Section>

          {/* Assinaturas */}
          <Section title={`Assinaturas (${subscriptions?.length ?? 0})`}>
            {(subscriptions ?? []).length === 0 ? (
              <p className="text-sm text-oli-lgray">Sem assinatura de plano</p>
            ) : (
              <div className="space-y-1">
                {(subscriptions ?? []).map(sub => {
                  const plan  = sub.plans as unknown as { name: string; preco_mensal: number; preco_anual: number } | null;
                  const valor = sub.ciclo === 'YEARLY' ? plan?.preco_anual : plan?.preco_mensal;
                  const status = sub.status ?? 'inactive';
                  return (
                    <div key={sub.id} className="flex items-center justify-between py-2.5 border-b border-oli-border last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-oli-dark">{plan?.name ?? '—'}</p>
                        <p className="text-xs text-oli-lgray">
                          {sub.ciclo === 'YEARLY' ? 'Anual' : 'Mensal'} · início {new Date(sub.starts_at).toLocaleDateString('pt-BR')}
                          {sub.ends_at ? ` · vence ${new Date(sub.ends_at).toLocaleDateString('pt-BR')}` : ''}
                          {sub.cancelled_at ? ` · cancelado ${new Date(sub.cancelled_at).toLocaleDateString('pt-BR')}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {valor && <span className="text-sm font-bold text-oli-dark">{brl(Number(valor))}</span>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100'}`}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Módulos contratados */}
          <Section title={`Módulos contratados (${userModules?.length ?? 0})`}>
            {(userModules ?? []).length === 0 ? (
              <p className="text-sm text-oli-lgray">Nenhum módulo contratado</p>
            ) : (
              <div className="space-y-1">
                {(userModules ?? []).map(um => {
                  const mod    = um.modules as unknown as { nome: string; valor: number; categoria: string; tipo: string } | null;
                  const status = um.status ?? 'inactive';
                  return (
                    <div key={um.id} className="flex items-center justify-between py-2.5 border-b border-oli-border last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-oli-dark">{mod?.nome ?? '—'}</p>
                        <p className="text-xs text-oli-lgray">
                          {mod?.categoria ?? '—'} · {mod?.tipo ?? '—'}
                          {um.activated_at ? ` · ativado ${new Date(um.activated_at).toLocaleDateString('pt-BR')}` : ''}
                          {um.ativo_ate    ? ` · até ${new Date(um.ativo_ate).toLocaleDateString('pt-BR')}` : ''}
                        </p>
                        {um.contract_url && (
                          <a
                            href={um.contract_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-oli-green hover:underline mt-0.5 block"
                          >
                            📄 Ver contrato
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {mod?.valor && <span className="text-sm font-bold text-oli-dark">{brl(mod.valor)}</span>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100'}`}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Saldo de horas */}
          <Section title={`Saldo de horas (${balances?.length ?? 0} pacotes)`}>
            <div className="flex gap-6 text-xs text-oli-lgray mb-4">
              <span>Total: <b className="text-oli-dark">{fmt(totalMin)}</b></span>
              <span>Usado: <b className="text-oli-dark">{fmt(usadoMin)}</b></span>
              <span>Restante: <b className="text-oli-green">{fmt(restante)}</b></span>
            </div>
            {(balances ?? []).length === 0 ? (
              <p className="text-sm text-oli-lgray">Nenhum pacote de horas</p>
            ) : (
              <div className="space-y-2">
                {(balances ?? []).map(b => {
                  const pct  = b.minutos_total > 0 ? Math.round((b.minutos_usados / b.minutos_total) * 100) : 0;
                  const rest = b.minutos_total - b.minutos_usados;
                  return (
                    <div key={b.id} className="py-2 border-b border-oli-border last:border-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-oli-dark font-semibold">{fmt(b.minutos_total)} compradas</span>
                        <span className="text-xs text-oli-lgray">
                          {fmt(rest)} restantes · expira {b.expira_em ? new Date(b.expira_em).toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 80 ? 'bg-oli-red' : 'bg-oli-green'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-oli-lgray w-8 text-right">{pct}%</span>
                      </div>
                      <p className="text-xs text-oli-lgray mt-1">
                        Adquirido em {new Date(b.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Reservas recentes */}
          {(reservations ?? []).length > 0 && (
            <Section title={`Reservas recentes (últimas ${reservations?.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-oli-border">
                      {['Sala', 'Início', 'Fim', 'Status', 'Chegou?'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-oli-border">
                    {(reservations ?? []).map(r => (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="py-2 pr-4 font-medium text-oli-dark">{r.room_name}</td>
                        <td className="py-2 pr-4 text-oli-gray">{new Date(r.start_time).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                        <td className="py-2 pr-4 text-oli-gray">{new Date(r.end_time).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                        <td className="py-2 pr-4">
                          <span className={`font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[r.status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABEL[r.status ?? ''] ?? r.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{r.arrived_at ? '✅ ' + new Date(r.arrived_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Sessões / cobranças */}
          {(sessions ?? []).length > 0 && (
            <Section title={`Sessões cobradas (últimas ${sessions?.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-oli-border">
                      {['Data', 'Duração', 'Tipo', 'Valor'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-oli-border">
                    {(sessions ?? []).map(s => (
                      <tr key={s.id} className="hover:bg-stone-50">
                        <td className="py-2 pr-4 text-oli-gray">
                          {new Date(s.iniciado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </td>
                        <td className="py-2 pr-4 text-oli-dark font-medium">{fmt(s.minutos ?? 0)}</td>
                        <td className="py-2 pr-4 text-oli-lgray">{s.tipo_cobranca ?? '—'}</td>
                        <td className="py-2 pr-4 font-semibold text-oli-dark">{s.valor_total ? brl(s.valor_total) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* NPS */}
          {(npsResponses ?? []).length > 0 && (
            <Section title={`NPS (${npsResponses?.length} resposta${npsResponses?.length !== 1 ? 's' : ''} · média ${npsMedia})`}>
              <div className="space-y-3">
                {(npsResponses ?? []).map((n, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-oli-border last:border-0">
                    <span className={`text-lg font-bold w-8 text-center ${n.score >= 9 ? 'text-oli-green' : n.score >= 7 ? 'text-yellow-600' : 'text-oli-red'}`}>
                      {n.score}
                    </span>
                    <div>
                      {n.comment && <p className="text-sm text-oli-dark">"{n.comment}"</p>}
                      <p className="text-xs text-oli-lgray mt-0.5">
                        {n.context ?? '—'} · {new Date(n.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}
