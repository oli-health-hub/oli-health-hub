import { createSupabaseAdmin } from '@/lib/supabase-server';
import { createCoupon, toggleCoupon } from '@/app/actions';

export const dynamic = 'force-dynamic';

interface Coupon {
  id: string;
  code: string;
  tipo: string;
  valor: number;
  aplicavel_a: string;
  plano_recorrente: boolean;
  validade: string | null;
  limite_uso: number | null;
  usos: number;
  ativo: boolean;
  descricao: string | null;
  created_at: string;
}

const APLIC_LABEL: Record<string, string> = {
  todos:   'Tudo',
  modulos: 'Módulos',
  planos:  'Planos',
  pacotes: 'Pacotes',
};

function formatValor(c: Coupon): string {
  return c.tipo === 'percentual'
    ? `${c.valor}%`
    : `R$ ${Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatData(iso: string | null): string {
  if (!iso) return 'Sem expiração';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default async function CuponsPage() {
  const supabase = await createSupabaseAdmin();
  const { data } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  const coupons = (data ?? []) as Coupon[];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-oli-dark">Cupons de desconto</h1>
        <p className="text-sm text-gray-500">Crie e gerencie cupons. Valor final mínimo de R$5 (regra do Asaas).</p>
      </div>

      {/* ── Criar cupom ── */}
      <form action={createCoupon} className="bg-white rounded-xl border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Código</label>
          <input name="code" required placeholder="EX: BEMVINDO20" className="border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Tipo</label>
          <select name="tipo" className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="percentual">Percentual (%)</option>
            <option value="fixo">Valor fixo (R$)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Valor</label>
          <input name="valor" type="number" step="0.01" min="0.01" required placeholder="20" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Aplicável a</label>
          <select name="aplicavel_a" className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="todos">Tudo</option>
            <option value="modulos">Módulos</option>
            <option value="planos">Planos</option>
            <option value="pacotes">Pacotes de horas</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Validade (opcional)</label>
          <input name="validade" type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Limite de usos (opcional)</label>
          <input name="limite_uso" type="number" min="1" placeholder="ilimitado" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-xs font-semibold text-gray-600">Descrição (opcional)</label>
          <input name="descricao" placeholder="Campanha de boas-vindas" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-1 self-end pb-2">
          <input name="plano_recorrente" type="checkbox" />
          Desconto recorrente (planos)
        </label>
        <div className="md:col-span-3">
          <button type="submit" className="bg-oli-green text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition">
            Criar cupom
          </button>
        </div>
      </form>

      {/* ── Lista ── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Desconto</th>
              <th className="text-left px-4 py-3">Aplicável</th>
              <th className="text-left px-4 py-3">Validade</th>
              <th className="text-left px-4 py-3">Usos</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Nenhum cupom criado ainda.</td></tr>
            )}
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-oli-dark">
                  {c.code}
                  {c.plano_recorrente && <span className="ml-2 text-[10px] text-gray-400">recorrente</span>}
                  {c.descricao && <div className="text-[11px] text-gray-400 font-sans font-normal">{c.descricao}</div>}
                </td>
                <td className="px-4 py-3">{formatValor(c)}</td>
                <td className="px-4 py-3">{APLIC_LABEL[c.aplicavel_a] ?? c.aplicavel_a}</td>
                <td className="px-4 py-3">{formatData(c.validade)}</td>
                <td className="px-4 py-3">{c.usos}{c.limite_uso ? ` / ${c.limite_uso}` : ''}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.ativo ? 'bg-green-50 text-oli-green' : 'bg-gray-100 text-gray-400'}`}>
                    {c.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleCoupon}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="ativo" value={String(c.ativo)} />
                    <button type="submit" className="text-xs text-gray-500 underline hover:text-oli-dark">
                      {c.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
