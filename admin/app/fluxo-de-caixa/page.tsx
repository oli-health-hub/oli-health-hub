import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { registrarSaida, quitarSaida } from '@/app/actions';
import ActionForm from '@/components/ActionForm';
import { getPaymentsByReceiptDate, type AsaasPayment } from '@/lib/asaas';
import KpiCard from '@/components/KpiCard';

export const dynamic = 'force-dynamic';

const SP = 'America/Sao_Paulo';
const MESES_EXIBIDOS = 6;
const ASAAS_PAGE_SIZE = 100;
const ASAAS_MAX_PAGES = 20;

const INPUT = 'h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors';

const CATEGORIAS = ['Aluguel', 'Condomínio', 'Limpeza', 'TI', 'Manutenção', 'Serviços', 'Impostos', 'Folha', 'Outros'];

function brl(v: number) {
  const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? '-' : ''}R$ ${abs}`;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (evita deslocamento de fuso). */
function dataBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function labelMes(key: string) {
  const [y, m] = key.split('-').map(Number);
  const nome = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' });
  return `${nome.replace('.', '')}/${y}`;
}

/** Últimos N meses (YYYY-MM), do mais antigo ao mês corrente, na data de São Paulo. */
function ultimosMeses(hoje: string, n: number): string[] {
  const [y, m] = hoje.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** Asaas liquidado (RECEIVED/CONFIRMED) por mês da data de pagamento, líquido de taxas. */
async function asaasPorMes(de: string, ate: string): Promise<{ porMes: Record<string, number>; erro: string | null }> {
  const porMes: Record<string, number> = {};
  try {
    for (let page = 0; page < ASAAS_MAX_PAGES; page++) {
      const res = await getPaymentsByReceiptDate({
        paymentDateFrom: de,
        paymentDateTo:   ate,
        offset: page * ASAAS_PAGE_SIZE,
        limit:  ASAAS_PAGE_SIZE,
      });
      res.data
        .filter((p: AsaasPayment) => (p.status === 'RECEIVED' || p.status === 'CONFIRMED') && p.paymentDate)
        .forEach((p: AsaasPayment) => {
          const mes = p.paymentDate!.slice(0, 7);
          porMes[mes] = (porMes[mes] ?? 0) + Number(p.netValue ?? p.value ?? 0);
        });
      if (!res.hasMore) break;
    }
    return { porMes, erro: null };
  } catch (err) {
    return { porMes: {}, erro: err instanceof Error ? err.message : String(err) };
  }
}

interface SaidaRow {
  id:         string;
  descricao:  string;
  valor:      number;
  vencimento: string;
  pago_em:    string | null;
  status:     string;
  categoria:  string | null;
  suppliers:  { nome: string } | null;
}

export default async function FluxoDeCaixaPage() {
  const supabase = await createSupabaseAdmin();

  const hoje   = new Date().toLocaleDateString('en-CA', { timeZone: SP });
  const meses  = ultimosMeses(hoje, MESES_EXIBIDOS);
  const de     = `${meses[0]}-01`;
  const mesAtual = meses[meses.length - 1];

  const [asaas, dinheiroRes, pagasRes, pendentesRes, suppliersRes] = await Promise.all([
    asaasPorMes(de, hoje),
    supabase.from('cash_receipts').select('valor, recebido_em').is('estornado_em', null).gte('recebido_em', de),
    supabase
      .from('financial_entries')
      .select('valor, pago_em')
      .eq('tipo', 'pagar')
      .eq('status', 'pago')
      .gte('pago_em', de),
    supabase
      .from('financial_entries')
      .select('id, descricao, valor, vencimento, pago_em, status, categoria, suppliers(nome)')
      .eq('tipo', 'pagar')
      .in('status', ['pendente', 'vencido'])
      .order('vencimento', { ascending: true })
      .limit(100),
    supabase.from('suppliers').select('id, nome').eq('ativo', true).order('nome', { ascending: true }),
  ]);

  const dinheiroPorMes: Record<string, number> = {};
  (dinheiroRes.data ?? []).forEach(r => {
    const mes = (r.recebido_em as string).slice(0, 7);
    dinheiroPorMes[mes] = (dinheiroPorMes[mes] ?? 0) + Number(r.valor);
  });

  const saidasPorMes: Record<string, number> = {};
  (pagasRes.data ?? []).forEach(r => {
    if (!r.pago_em) return;
    const mes = (r.pago_em as string).slice(0, 7);
    saidasPorMes[mes] = (saidasPorMes[mes] ?? 0) + Number(r.valor);
  });

  const pendentes = (pendentesRes.data ?? []) as unknown as SaidaRow[];
  const totalAPagar = pendentes.reduce((s, r) => s + Number(r.valor), 0);
  const suppliers = suppliersRes.data ?? [];

  const linhas = meses.map(mes => {
    const dinheiro = dinheiroPorMes[mes] ?? 0;
    const asaasV   = asaas.porMes[mes] ?? 0;
    const entradas = dinheiro + asaasV;
    const saidas   = saidasPorMes[mes] ?? 0;
    return { mes, dinheiro, asaas: asaasV, entradas, saidas, saldo: entradas - saidas };
  });

  const total = linhas.reduce(
    (t, l) => ({
      dinheiro: t.dinheiro + l.dinheiro,
      asaas:    t.asaas    + l.asaas,
      entradas: t.entradas + l.entradas,
      saidas:   t.saidas   + l.saidas,
      saldo:    t.saldo    + l.saldo,
    }),
    { dinheiro: 0, asaas: 0, entradas: 0, saidas: 0, saldo: 0 },
  );
  const atual = linhas[linhas.length - 1];

  return (
    <div className="p-7 space-y-7">
      <div>
        <h1 className="text-xl font-bold text-oli-dark">Fluxo de caixa</h1>
        <p className="text-sm text-oli-lgray mt-0.5">
          Entradas realizadas (Asaas liquidado + dinheiro registrado em{' '}
          <Link href="/recebimentos" className="text-oli-green font-semibold hover:underline">Recebimentos</Link>
          ) menos saídas pagas, nos últimos {MESES_EXIBIDOS} meses.
        </p>
      </div>

      {asaas.erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-oli-red">
          Não foi possível ler o Asaas ({asaas.erro}). As entradas do Asaas aparecem como R$ 0,00 e os totais estão incompletos.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label={`Entradas ${labelMes(mesAtual)}`} value={brl(atual.entradas)} badge={`dinheiro ${brl(atual.dinheiro)}`} />
        <KpiCard label={`Saídas ${labelMes(mesAtual)}`} value={brl(atual.saidas)} color="gold" />
        <KpiCard label={`Saldo ${labelMes(mesAtual)}`} value={brl(atual.saldo)} badge={atual.saldo < 0 ? 'negativo' : 'positivo'} color={atual.saldo < 0 ? 'gold' : 'green'} />
        <KpiCard label="A pagar (pendente)" value={brl(totalAPagar)} badge={`${pendentes.length} conta${pendentes.length !== 1 ? 's' : ''}`} color="gold" />
      </div>

      {/* ── Resumo mensal ── */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">Resumo por mês</h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Mês', 'Asaas (líquido)', 'Dinheiro', 'Total entradas', 'Saídas', 'Saldo'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {[...linhas].reverse().map(l => (
                  <tr key={l.mes} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-oli-dark">{labelMes(l.mes)}</td>
                    <td className="px-4 py-3 text-oli-gray">{brl(l.asaas)}</td>
                    <td className="px-4 py-3 text-oli-gray">{brl(l.dinheiro)}</td>
                    <td className="px-4 py-3 font-semibold text-oli-dark">{brl(l.entradas)}</td>
                    <td className="px-4 py-3 text-oli-gray">{brl(l.saidas)}</td>
                    <td className={`px-4 py-3 font-bold ${l.saldo < 0 ? 'text-oli-red' : 'text-oli-green'}`}>{brl(l.saldo)}</td>
                  </tr>
                ))}
                <tr className="bg-stone-50">
                  <td className="px-4 py-3 font-bold text-oli-dark">Total</td>
                  <td className="px-4 py-3 font-bold text-oli-dark">{brl(total.asaas)}</td>
                  <td className="px-4 py-3 font-bold text-oli-dark">{brl(total.dinheiro)}</td>
                  <td className="px-4 py-3 font-bold text-oli-dark">{brl(total.entradas)}</td>
                  <td className="px-4 py-3 font-bold text-oli-dark">{brl(total.saidas)}</td>
                  <td className={`px-4 py-3 font-bold ${total.saldo < 0 ? 'text-oli-red' : 'text-oli-green'}`}>{brl(total.saldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Nova saída ── */}
      <div className="bg-white rounded-2xl border border-oli-border p-6">
        <h2 className="text-sm font-bold text-oli-dark mb-4">Lançar saída</h2>
        <ActionForm
          action={registrarSaida}
          formClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4"
          footerClassName="md:col-span-2 xl:col-span-3"
          buttonClassName="h-10 px-5 rounded-xl bg-oli-green text-white text-sm font-semibold hover:bg-oli-green/80 transition-colors"
          submitLabel="Lançar saída"
          pendingLabel="Lançando…"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="descricao" className="block text-sm font-semibold text-oli-dark">Descrição *</label>
            <input id="descricao" name="descricao" required placeholder="Ex.: Aluguel da sala 3" className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="saida-valor" className="block text-sm font-semibold text-oli-dark">Valor (R$) *</label>
            <input id="saida-valor" name="valor" required inputMode="decimal" placeholder="1.500,00" className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="data" className="block text-sm font-semibold text-oli-dark">Data (pagamento ou vencimento) *</label>
            <input id="data" name="data" type="date" required defaultValue={hoje} className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="situacao" className="block text-sm font-semibold text-oli-dark">Situação *</label>
            <select id="situacao" name="situacao" defaultValue="pago" className={INPUT}>
              <option value="pago">Pago (entra no fluxo na data)</option>
              <option value="pendente">A pagar (previsto)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="categoria" className="block text-sm font-semibold text-oli-dark">Categoria</label>
            <select id="categoria" name="categoria" defaultValue="" className={INPUT}>
              <option value="">Selecionar...</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="supplier_id" className="block text-sm font-semibold text-oli-dark">Fornecedor</label>
            <select id="supplier_id" name="supplier_id" defaultValue="" className={INPUT}>
              <option value="">Nenhum</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        </ActionForm>
      </div>

      {/* ── Contas a pagar ── */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">Contas a pagar</h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Vencimento', 'Descrição', 'Fornecedor', 'Categoria', 'Valor', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {pendentes.map(r => {
                  const vencida = r.vencimento < hoje;
                  return (
                    <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                      <td className={`px-4 py-3 whitespace-nowrap ${vencida ? 'text-oli-red font-semibold' : 'text-oli-gray'}`}>
                        {dataBR(r.vencimento)}{vencida ? ' · vencida' : ''}
                      </td>
                      <td className="px-4 py-3 font-semibold text-oli-dark">{r.descricao}</td>
                      <td className="px-4 py-3 text-oli-gray">{r.suppliers?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-oli-gray">{r.categoria ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-oli-dark whitespace-nowrap">{brl(Number(r.valor))}</td>
                      <td className="px-4 py-3">
                        <ActionForm
                          action={quitarSaida}
                          buttonClassName="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors"
                          submitLabel="Marcar como paga hoje"
                          pendingLabel="Salvando…"
                        >
                          <input type="hidden" name="id" value={r.id} />
                        </ActionForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pendentes.length === 0 && (
              <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                Nenhuma conta a pagar
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
