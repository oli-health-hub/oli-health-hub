import { createSupabaseAdmin } from '@/lib/supabase-server';
import { criarPromocao, alternarPromocao } from '@/app/actions';
import ActionForm from '@/components/ActionForm';

export const dynamic = 'force-dynamic';

const SP = 'America/Sao_Paulo';

const INPUT = 'h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors';

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (evita deslocamento de fuso). */
function dataBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function horas(h: number) {
  return `${Number(h).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`;
}

interface PromoRow {
  id:                       string;
  nome:                     string;
  descricao:                string | null;
  ativo:                    boolean;
  vigencia_inicio:          string | null;
  vigencia_fim:             string | null;
  aplica_a:                 'plano' | 'pacote_horas';
  ciclo:                    string | null;
  horas_bonus:              number;
  validade_dias:            number;
  uma_vez_por_profissional: boolean;
  limite_usos:              number | null;
  plans:                    { name: string } | null;
  hour_packages:            { nome: string } | null;
}

function situacao(p: PromoRow, hoje: string): { label: string; classe: string } {
  if (!p.ativo)                                    return { label: 'Pausada',   classe: 'bg-gray-100 text-gray-600' };
  if (p.vigencia_fim && p.vigencia_fim < hoje)     return { label: 'Encerrada', classe: 'bg-gray-100 text-gray-600' };
  if (p.vigencia_inicio && p.vigencia_inicio > hoje) return { label: 'Agendada',  classe: 'bg-amber-50 text-amber-700' };
  return { label: 'Ativa', classe: 'bg-green-50 text-oli-green' };
}

export default async function PromocoesPage() {
  const supabase = await createSupabaseAdmin();
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: SP });

  const [promosRes, resgatesRes, plansRes, packagesRes] = await Promise.all([
    supabase
      .from('promotions')
      .select('id, nome, descricao, ativo, vigencia_inicio, vigencia_fim, aplica_a, ciclo, horas_bonus, validade_dias, uma_vez_por_profissional, limite_usos, plans(name), hour_packages(nome)')
      .order('created_at', { ascending: false }),
    supabase.from('promotion_redemptions').select('promotion_id, minutos').is('estornado_em', null),
    supabase.from('plans').select('id, name').eq('ativo', true).gt('preco_mensal', 0).order('preco_mensal', { ascending: true }),
    supabase.from('hour_packages').select('id, nome').eq('ativo', true).order('horas', { ascending: true }),
  ]);

  const promos   = (promosRes.data ?? []) as unknown as PromoRow[];
  const plans    = plansRes.data ?? [];
  const packages = packagesRes.data ?? [];

  const usos: Record<string, { n: number; minutos: number }> = {};
  (resgatesRes.data ?? []).forEach(r => {
    const u = usos[r.promotion_id] ?? { n: 0, minutos: 0 };
    u.n += 1;
    u.minutos += r.minutos;
    usos[r.promotion_id] = u;
  });

  return (
    <div className="p-7 space-y-7">
      <div>
        <h1 className="text-xl font-bold text-oli-dark">Promoções</h1>
        <p className="text-sm text-oli-lgray mt-0.5">
          Horas de bônus concedidas automaticamente quando o produto da condição é pago. Diferente de cupom, que dá desconto no preço.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <b>Onde a promoção é aplicada hoje:</b> nos recebimentos em dinheiro registrados em Recebimentos.
        Pagamentos pelo app (cartão e PIX, via Asaas) <b>ainda não aplicam</b> promoção: dependem de uma alteração no
        webhook do Asaas, que ainda não foi publicada. Enquanto isso, esses casos precisam de crédito manual.
      </div>

      {/* ── Nova promoção ── */}
      <div className="bg-white rounded-2xl border border-oli-border p-6">
        <h2 className="text-sm font-bold text-oli-dark mb-4">Nova promoção</h2>
        <ActionForm
          action={criarPromocao}
          formClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4"
          footerClassName="md:col-span-2 xl:col-span-3"
          buttonClassName="h-10 px-5 rounded-xl bg-oli-green text-white text-sm font-semibold hover:bg-oli-green/80 transition-colors"
          submitLabel="Criar promoção"
          pendingLabel="Criando…"
        >
          <div className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-2">
            <label htmlFor="nome" className="block text-sm font-semibold text-oli-dark">Nome *</label>
            <input id="nome" name="nome" required minLength={3} placeholder="Ex.: PRO mensal vira 6 horas" className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="horas_bonus" className="block text-sm font-semibold text-oli-dark">Horas de bônus *</label>
            <input id="horas_bonus" name="horas_bonus" required inputMode="decimal" placeholder="6" className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="aplica_a" className="block text-sm font-semibold text-oli-dark">Vale quando pagar *</label>
            <select id="aplica_a" name="aplica_a" required defaultValue="plano" className={INPUT}>
              <option value="plano">Um plano</option>
              <option value="pacote_horas">Um pacote de horas</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan_id" className="block text-sm font-semibold text-oli-dark">Plano (se for plano)</label>
            <select id="plan_id" name="plan_id" defaultValue="" className={INPUT}>
              <option value="">Selecionar...</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ciclo" className="block text-sm font-semibold text-oli-dark">Ciclo do plano</label>
            <select id="ciclo" name="ciclo" defaultValue="mensal" className={INPUT}>
              <option value="mensal">Só mensal</option>
              <option value="semestral">Só semestral</option>
              <option value="">Qualquer ciclo</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="package_id" className="block text-sm font-semibold text-oli-dark">Pacote (se for pacote de horas)</label>
            <select id="package_id" name="package_id" defaultValue="" className={INPUT}>
              <option value="">Qualquer pacote</option>
              {packages.map(k => <option key={k.id} value={k.id}>{k.nome}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="validade_dias" className="block text-sm font-semibold text-oli-dark">Validade das horas (dias)</label>
            <input id="validade_dias" name="validade_dias" type="number" min="1" step="1" defaultValue="365" className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="vigencia_inicio" className="block text-sm font-semibold text-oli-dark">Início</label>
            <input id="vigencia_inicio" name="vigencia_inicio" type="date" className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="vigencia_fim" className="block text-sm font-semibold text-oli-dark">Fim</label>
            <input id="vigencia_fim" name="vigencia_fim" type="date" className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="limite_usos" className="block text-sm font-semibold text-oli-dark">Limite de usos (total)</label>
            <input id="limite_usos" name="limite_usos" type="number" min="1" step="1" placeholder="Sem limite" className={INPUT} />
          </div>

          <div className="flex items-center gap-2 md:col-span-2 xl:col-span-3">
            <input id="uma_vez" name="uma_vez_por_profissional" type="checkbox" className="h-4 w-4 accent-oli-green" />
            <label htmlFor="uma_vez" className="text-sm text-oli-dark">Vale só uma vez por profissional</label>
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-3">
            <label htmlFor="descricao" className="block text-sm font-semibold text-oli-dark">Descrição (interna)</label>
            <input id="descricao" name="descricao" placeholder="Ex.: ação de lançamento do PRO, outubro de 2026" className={INPUT} />
          </div>
        </ActionForm>
      </div>

      {/* ── Lista ── */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">Promoções cadastradas</h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Promoção', 'Condição', 'Benefício', 'Vigência', 'Usos', 'Situação', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {promos.map(p => {
                  const sit = situacao(p, hoje);
                  const u   = usos[p.id] ?? { n: 0, minutos: 0 };
                  const condicao = p.aplica_a === 'plano'
                    ? `Plano ${p.plans?.name ?? ''} · ${p.ciclo ?? 'qualquer ciclo'}`
                    : `Pacote: ${p.hour_packages?.nome ?? 'qualquer'}`;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-oli-dark">{p.nome}</div>
                        {p.descricao && <div className="text-xs text-oli-lgray mt-0.5">{p.descricao}</div>}
                      </td>
                      <td className="px-4 py-3 text-oli-gray">
                        {condicao}
                        {p.uma_vez_por_profissional && <div className="text-xs text-oli-lgray">uma vez por profissional</div>}
                      </td>
                      <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                        <span className="font-semibold text-oli-green">+{horas(p.horas_bonus)}</span>
                        <div className="text-xs text-oli-lgray">válidas por {p.validade_dias} dias</div>
                      </td>
                      <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                        {p.vigencia_inicio || p.vigencia_fim
                          ? `${p.vigencia_inicio ? dataBR(p.vigencia_inicio) : 'sempre'} até ${p.vigencia_fim ? dataBR(p.vigencia_fim) : 'sem prazo'}`
                          : 'Sem prazo'}
                      </td>
                      <td className="px-4 py-3 text-oli-gray whitespace-nowrap">
                        {u.n}{p.limite_usos ? ` de ${p.limite_usos}` : ''}
                        {u.n > 0 && <div className="text-xs text-oli-lgray">{horas(u.minutos / 60)} concedidas</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sit.classe}`}>{sit.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionForm
                          action={alternarPromocao}
                          buttonClassName="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-oli-border text-oli-lgray hover:text-oli-dark transition-colors"
                          submitLabel={p.ativo ? 'Pausar' : 'Reativar'}
                          pendingLabel="Salvando…"
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="ativo" value={p.ativo ? 'false' : 'true'} />
                        </ActionForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {promos.length === 0 && (
              <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                Nenhuma promoção cadastrada
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
