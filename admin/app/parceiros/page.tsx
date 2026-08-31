import { createSupabaseAdmin } from '@/lib/supabase-server';
import { registerCommissionPayment } from '@/app/actions';

export const dynamic = 'force-dynamic';

/**
 * Programa de Indicação de Parceiros Externos — modelo de comissão fechado
 * (sessão 21/jul, docs/HANDOFF.md §11 item 19). Comissão ancorada na
 * mensalidade do plano, pagamento único por indicado/tipo — nunca recorrente.
 * Valores exatos vêm do documento de comissionamento acordado com o fundador.
 */
const TIER_LABEL: Record<string, string> = {
  primeira_hora_start: '1ª hora (START)',
  base_anual:          'BASE anual',
  pro_anual:           'PRO anual',
  base_mensal:         'BASE mensal (60d)',
  pro_mensal:          'PRO mensal (60d)',
};

interface Partner {
  id:            string;
  nome:          string;
  referral_code: string | null;
}

interface Indicado {
  id:                 string;
  nome:               string;
  plan:               string;
  onboarding_complete: boolean;
  created_at:         string;
  deleted_at:         string | null;
}

interface CommissionLine {
  tipo:      string;
  valor:     number;
  devidoEm:  string;
  pago:      boolean;
  pagoEm:    string | null;
}

interface CommissionConfig {
  partner_id:           string;
  comissiona:           boolean;
  primeira_hora_pct:    number;
  valor_base_anual:     number;
  valor_pro_anual:      number;
  valor_base_mensal:    number;
  valor_pro_mensal:     number;
  carencia_dias_mensal: number;
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default async function ParceirosPage() {
  const supabase = await createSupabaseAdmin();

  const { data: partnersRaw } = await supabase
    .from('profiles')
    .select('id, nome, referral_code')
    .eq('user_type', 'partner');
  const partners = (partnersRaw ?? []) as Partner[];
  const partnerIds = partners.map(p => p.id);

  if (partnerIds.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-oli-dark">Parceiros</h1>
        <p className="text-sm text-gray-500 mt-2">Nenhum parceiro externo cadastrado ainda.</p>
      </div>
    );
  }

  const [{ data: referrals }, { data: paymentsRaw }, { data: configsRaw }] = await Promise.all([
    supabase.from('referrals').select('indicador_id, indicado_id').in('indicador_id', partnerIds),
    supabase.from('partner_commission_payments').select('*').in('partner_id', partnerIds),
    supabase.from('partner_commission_config').select('*').in('partner_id', partnerIds),
  ]);
  const configByPartner = new Map((configsRaw ?? []).map((c) => [c.partner_id, c as CommissionConfig]));
  const DEFAULT_CONFIG: Omit<CommissionConfig, 'partner_id'> = {
    comissiona: true, primeira_hora_pct: 100, valor_base_anual: 359, valor_pro_anual: 719,
    valor_base_mensal: 179, valor_pro_mensal: 359, carencia_dias_mensal: 60,
  };

  const indicadoIds = Array.from(new Set((referrals ?? []).map(r => r.indicado_id).filter(Boolean))) as string[];

  const [{ data: indicadosRaw }, { data: subsRaw }, { data: usageRaw }] = await Promise.all([
    indicadoIds.length
      ? supabase.from('profiles').select('id, nome, plan, onboarding_complete, created_at, deleted_at').in('id', indicadoIds)
      : Promise.resolve({ data: [] as Indicado[] }),
    indicadoIds.length
      ? supabase.from('subscriptions').select('professional_id, ciclo, status, starts_at').in('professional_id', indicadoIds).eq('status', 'active')
      : Promise.resolve({ data: [] }),
    indicadoIds.length
      ? supabase.from('usage_charges').select('professional_id, valor_total, iniciado_em').in('professional_id', indicadoIds).order('iniciado_em', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const indicados = (indicadosRaw ?? []) as Indicado[];
  const indicadoById = new Map(indicados.map(i => [i.id, i]));
  const subs = subsRaw ?? [];
  const payments = (paymentsRaw ?? []) as { referred_professional_id: string; tipo: string; valor: number; pago_em: string }[];

  const firstUsageByProf = new Map<string, { valor_total: number; iniciado_em: string }>();
  for (const row of usageRaw ?? []) {
    if (!firstUsageByProf.has(row.professional_id)) firstUsageByProf.set(row.professional_id, row);
  }

  function commissionLines(indicado: Indicado, config: CommissionConfig): CommissionLine[] {
    if (!config.comissiona) return [];
    const lines: CommissionLine[] = [];
    const paidFor = (tipo: string) => payments.find(p => p.referred_professional_id === indicado.id && p.tipo === tipo);

    const firstUsage = firstUsageByProf.get(indicado.id);
    if (indicado.plan === 'START' && firstUsage && config.primeira_hora_pct > 0) {
      const paid = paidFor('primeira_hora_start');
      const valor = firstUsage.valor_total * (config.primeira_hora_pct / 100);
      lines.push({ tipo: 'primeira_hora_start', valor, devidoEm: firstUsage.iniciado_em, pago: !!paid, pagoEm: paid?.pago_em ?? null });
    }

    for (const sub of subs.filter(s => s.professional_id === indicado.id)) {
      if (sub.ciclo === 'anual') {
        if (indicado.plan === 'BASE' && config.valor_base_anual > 0) {
          const paid = paidFor('base_anual');
          lines.push({ tipo: 'base_anual', valor: config.valor_base_anual, devidoEm: sub.starts_at, pago: !!paid, pagoEm: paid?.pago_em ?? null });
        } else if (indicado.plan === 'PRO' && config.valor_pro_anual > 0) {
          const paid = paidFor('pro_anual');
          lines.push({ tipo: 'pro_anual', valor: config.valor_pro_anual, devidoEm: sub.starts_at, pago: !!paid, pagoEm: paid?.pago_em ?? null });
        }
      } else if (sub.ciclo === 'mensal') {
        const carenciaMs = config.carencia_dias_mensal * 24 * 60 * 60 * 1000;
        const devidoEm = new Date(new Date(sub.starts_at).getTime() + carenciaMs).toISOString();
        const carenciaCumprida = Date.now() >= new Date(devidoEm).getTime();
        if (carenciaCumprida && indicado.plan === 'BASE' && config.valor_base_mensal > 0) {
          const paid = paidFor('base_mensal');
          lines.push({ tipo: 'base_mensal', valor: config.valor_base_mensal, devidoEm, pago: !!paid, pagoEm: paid?.pago_em ?? null });
        } else if (carenciaCumprida && indicado.plan === 'PRO' && config.valor_pro_mensal > 0) {
          const paid = paidFor('pro_mensal');
          lines.push({ tipo: 'pro_mensal', valor: config.valor_pro_mensal, devidoEm, pago: !!paid, pagoEm: paid?.pago_em ?? null });
        }
      }
    }
    return lines;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-oli-dark">Parceiros</h1>
        <p className="text-sm text-gray-500">
          Programa de Indicação de Parceiros Externos — indicações geradas e comissão devida/paga por parceiro.
          Comissão calculada automaticamente; o pagamento é registrado manualmente após ser feito de verdade.
        </p>
      </div>

      {partners.map((partner) => {
        const meusIndicadoIds = (referrals ?? [])
          .filter(r => r.indicador_id === partner.id)
          .map(r => r.indicado_id)
          .filter(Boolean) as string[];
        const meusIndicados = meusIndicadoIds.map(id => indicadoById.get(id)).filter(Boolean) as Indicado[];
        const config = configByPartner.get(partner.id) ?? { partner_id: partner.id, ...DEFAULT_CONFIG };

        return (
          // overflow-x-auto, não overflow-hidden: em tela menor a tabela rola em
          // vez de cortar coluna (mesmo motivo do /leads).
          <div key={partner.id} className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-oli-dark">{partner.nome}</p>
                <p className="text-xs text-gray-400 font-mono">{partner.referral_code ?? 'sem código'}</p>
                {!config.comissiona && (
                  <p className="text-[11px] text-gray-400 mt-0.5">Só gera leads — sem comissionamento</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{meusIndicados.length} indicação{meusIndicados.length === 1 ? '' : 'ões'}</p>
                <a href={`/equipe/${partner.id}`} className="text-xs text-oli-green underline">Editar comissão →</a>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Indicado</th>
                  <th className="text-left px-4 py-2">Plano</th>
                  <th className="text-left px-4 py-2">Cadastro</th>
                  <th className="text-left px-4 py-2">Comissão</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {meusIndicados.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400">Nenhum cadastro ainda.</td></tr>
                )}
                {meusIndicados.map((indicado) => {
                  const lines = commissionLines(indicado, config);
                  return (
                    <tr key={indicado.id} className="border-t border-gray-50 align-top">
                      <td className="px-4 py-3 font-medium text-oli-dark">
                        {indicado.nome}
                        {indicado.deleted_at && <span className="ml-2 text-[10px] text-gray-400">excluído</span>}
                      </td>
                      <td className="px-4 py-3">{indicado.plan}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtData(indicado.created_at)}</td>
                      <td className="px-4 py-3">
                        {lines.length === 0 && (
                          <span className="text-gray-400">{config.comissiona ? 'Sem comissão devida ainda' : 'Parceiro não comissiona'}</span>
                        )}
                        {lines.map((line) => (
                          <div key={line.tipo} className="flex items-center gap-2 mb-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${line.pago ? 'bg-green-50 text-oli-green' : 'bg-yellow-50 text-yellow-700'}`}>
                              {line.pago ? 'Pago' : 'Devido'}
                            </span>
                            <span className="text-xs text-gray-600">{TIER_LABEL[line.tipo]} — {fmtBRL(line.valor)}</span>
                            {line.pago && <span className="text-[10px] text-gray-400">em {fmtData(line.pagoEm!)}</span>}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {lines.filter(l => !l.pago).map((line) => (
                          <form key={line.tipo} action={registerCommissionPayment} className="mb-1.5">
                            <input type="hidden" name="partner_id" value={partner.id} />
                            <input type="hidden" name="referred_id" value={indicado.id} />
                            <input type="hidden" name="tipo" value={line.tipo} />
                            <input type="hidden" name="valor" value={line.valor} />
                            <button type="submit" className="text-xs text-oli-green font-semibold underline">
                              Marcar {TIER_LABEL[line.tipo]} como paga
                            </button>
                          </form>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
