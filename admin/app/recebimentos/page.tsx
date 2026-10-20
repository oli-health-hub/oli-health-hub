import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { registrarRecebimentoDinheiro } from '@/app/actions';
import KpiCard from '@/components/KpiCard';
import EstornarRecebimentoForm from './EstornarRecebimentoForm';

export const dynamic = 'force-dynamic';

const SP = 'America/Sao_Paulo';

const INPUT = 'h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors';

function brl(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (evita deslocamento de fuso). */
function dataBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface PlanRow    { id: string; name: string; preco_mensal: number | null; preco_semestral: number | null }
interface PackageRow { id: string; nome: string; horas: number }
interface MedicoRow  { id: string; nome: string; plan: string | null }
interface ReceiptRow {
  id:             string;
  tipo:           'plano' | 'pacote_horas';
  valor:          number;
  recebido_em:    string;
  ciclo:          string | null;
  meses_cobertos: number | null;
  observacoes:    string | null;
  estornado_em:   string | null;
  estorno_motivo: string | null;
  profiles:       { id: string; nome: string } | null;
  plans:          { name: string } | null;
  hour_packages:  { nome: string } | null;
}

export default async function RecebimentosPage() {
  const supabase = await createSupabaseAdmin();

  const hoje        = new Date().toLocaleDateString('en-CA', { timeZone: SP });
  const inicioMes   = `${hoje.slice(0, 7)}-01`;

  const [medicosRes, plansRes, packagesRes, receiptsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nome, plan')
      .not('user_type', 'in', '(admin,founder,specialist,partner,pending,team)')
      .neq('account_status', 'deleted')
      .order('nome', { ascending: true })
      .limit(500),
    supabase
      .from('plans')
      .select('id, name, preco_mensal, preco_semestral')
      .eq('ativo', true)
      .gt('preco_mensal', 0)
      .order('preco_mensal', { ascending: true }),
    supabase
      .from('hour_packages')
      .select('id, nome, horas')
      .eq('ativo', true)
      .order('horas', { ascending: true }),
    supabase
      .from('cash_receipts')
      .select('id, tipo, valor, recebido_em, ciclo, meses_cobertos, observacoes, estornado_em, estorno_motivo, profiles(id, nome), plans(name), hour_packages(nome)')
      .order('recebido_em', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const medicos  = (medicosRes.data  ?? []) as MedicoRow[];
  const plans    = (plansRes.data    ?? []) as PlanRow[];
  const packages = (packagesRes.data ?? []) as PackageRow[];
  const receipts = (receiptsRes.data ?? []) as unknown as ReceiptRow[];

  const validos    = receipts.filter(r => !r.estornado_em);
  const doMes      = validos.filter(r => r.recebido_em >= inicioMes);
  const totalMes   = doMes.reduce((s, r) => s + Number(r.valor), 0);
  const totalLista = validos.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div className="p-7 space-y-7">
      <div>
        <h1 className="text-xl font-bold text-oli-dark">Recebimentos em dinheiro</h1>
        <p className="text-sm text-oli-lgray mt-0.5">
          Ao registrar, o plano PRO ou as horas são ativados na hora e o valor entra no{' '}
          <Link href="/fluxo-de-caixa" className="text-oli-green font-semibold hover:underline">Fluxo de caixa</Link>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Recebido em dinheiro (mês)" value={brl(totalMes)} badge={`${doMes.length} recebimento${doMes.length !== 1 ? 's' : ''}`} />
        <KpiCard label="Total na lista" value={brl(totalLista)} badge={`${validos.length} válido${validos.length !== 1 ? 's' : ''} na lista`} color="gold" />
      </div>

      {/* ── Novo recebimento ── */}
      <div className="bg-white rounded-2xl border border-oli-border p-6">
        <h2 className="text-sm font-bold text-oli-dark mb-4">Novo recebimento</h2>
        <form action={registrarRecebimentoDinheiro} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="professional_id" className="block text-sm font-semibold text-oli-dark">Profissional *</label>
            <select id="professional_id" name="professional_id" required defaultValue="" className={INPUT}>
              <option value="" disabled>Selecionar...</option>
              {medicos.map(m => (
                <option key={m.id} value={m.id}>{m.nome}{m.plan ? ` (${m.plan})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="item" className="block text-sm font-semibold text-oli-dark">O que foi pago *</label>
            <select id="item" name="item" required defaultValue="" className={INPUT}>
              <option value="" disabled>Selecionar...</option>
              <optgroup label="Plano">
                {plans.map(p => (
                  <option key={`${p.id}-m`} value={`plano:${p.id}:mensal`}>
                    {p.name} mensal — {brl(Number(p.preco_mensal))}/mês
                  </option>
                ))}
                {plans.filter(p => p.preco_semestral != null).map(p => (
                  <option key={`${p.id}-s`} value={`plano:${p.id}:semestral`}>
                    {p.name} semestral — {brl(Number(p.preco_semestral))}/mês (fidelidade 6 meses)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Pacote de horas">
                {packages.map(k => (
                  <option key={k.id} value={`pacote:${k.id}`}>{k.nome}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="valor" className="block text-sm font-semibold text-oli-dark">Valor recebido (R$) *</label>
            <input id="valor" name="valor" required inputMode="decimal" placeholder="299,00" className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="recebido_em" className="block text-sm font-semibold text-oli-dark">Data do recebimento *</label>
            <input id="recebido_em" name="recebido_em" type="date" required defaultValue={hoje} max={hoje} className={INPUT} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="meses" className="block text-sm font-semibold text-oli-dark">Meses de plano cobertos</label>
            <input id="meses" name="meses" type="number" min="1" step="1" defaultValue="1" className={INPUT} />
            <span className="text-[11px] text-oli-lgray">Só vale para plano: define até quando o PRO fica ativo.</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="observacoes" className="block text-sm font-semibold text-oli-dark">Observações</label>
            <input id="observacoes" name="observacoes" placeholder="Ex.: recebido na recepção, recibo nº 12" className={INPUT} />
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <button
              type="submit"
              className="h-10 px-5 rounded-xl bg-oli-green text-white text-sm font-semibold hover:bg-oli-green/80 transition-colors"
            >
              Registrar recebimento e ativar
            </button>
          </div>
        </form>
      </div>

      {/* ── Histórico ── */}
      <section>
        <h2 className="text-sm font-bold text-oli-dark mb-3">Histórico</h2>
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Data', 'Profissional', 'Referente a', 'Valor', 'Observações', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {receipts.map(r => (
                  <tr key={r.id} className={`hover:bg-stone-50 transition-colors ${r.estornado_em ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-oli-gray whitespace-nowrap">{dataBR(r.recebido_em)}</td>
                    <td className="px-4 py-3">
                      {r.profiles ? (
                        <Link href={`/medicos/${r.profiles.id}`} className="font-semibold text-oli-dark hover:text-oli-green transition-colors">
                          {r.profiles.nome}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-oli-gray">
                      {r.tipo === 'plano'
                        ? `${r.plans?.name ?? 'Plano'} ${r.ciclo ?? ''} · ${r.meses_cobertos ?? 1} mês(es)`
                        : r.hour_packages?.nome ?? 'Pacote de horas'}
                    </td>
                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${r.estornado_em ? 'text-oli-lgray line-through' : 'text-oli-green'}`}>{brl(Number(r.valor))}</td>
                    <td className="px-4 py-3 text-oli-lgray">{r.observacoes ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.estornado_em ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-oli-red" title={r.estorno_motivo ?? undefined}>
                          Estornado em {new Date(r.estornado_em).toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <EstornarRecebimentoForm id={r.id} tipo={r.tipo} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {receipts.length === 0 && (
              <div className="flex items-center justify-center py-10 text-oli-lgray text-sm">
                Nenhum recebimento em dinheiro registrado
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
