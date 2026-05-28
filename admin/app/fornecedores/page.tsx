import { createSupabaseServer } from '@/lib/supabase-server';
import { upsertSupplier, deactivateSupplier } from '@/app/actions';

export const dynamic = 'force-dynamic';

const CATEGORIAS = ['Limpeza', 'TI', 'Manutenção', 'Serviços', 'Saúde', 'Segurança', 'Outros'];

const CAT_COLOR: Record<string, string> = {
  'Limpeza':    'bg-blue-50 text-blue-700',
  'TI':         'bg-violet-50 text-violet-700',
  'Manutenção': 'bg-amber-50 text-amber-700',
  'Serviços':   'bg-teal-50 text-teal-700',
  'Saúde':      'bg-green-50 text-green-700',
  'Segurança':  'bg-red-50 text-red-700',
  'Outros':     'bg-gray-100 text-gray-600',
};

export default async function FornecedoresPage() {
  const supabase = await createSupabaseServer();

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  const ativos   = (suppliers ?? []).length;

  return (
    <div className="p-7 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Fornecedores</h1>
          <p className="text-sm text-oli-lgray mt-0.5">{ativos} fornecedor{ativos !== 1 ? 'es' : ''} ativo{ativos !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Formulário novo fornecedor ── */}
      <div className="bg-white rounded-2xl border border-oli-border p-6">
        <h2 className="text-sm font-bold text-oli-dark mb-4">Novo Fornecedor</h2>
        <form action={upsertSupplier} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-oli-dark">Nome *</label>
            <input
              name="nome"
              required
              placeholder="Razão social ou nome"
              className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-oli-dark">Categoria</label>
            <select
              name="categoria"
              className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors"
            >
              <option value="">Selecionar...</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-oli-dark">CNPJ / CPF</label>
            <input
              name="cnpj"
              placeholder="00.000.000/0001-00"
              className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-oli-dark">Contato</label>
            <input
              name="contato"
              placeholder="Nome do responsável"
              className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-oli-dark">Telefone</label>
            <input
              name="telefone"
              placeholder="(11) 99999-9999"
              className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-oli-dark">E-mail</label>
            <input
              name="email"
              type="email"
              placeholder="contato@empresa.com.br"
              className="h-10 w-full border border-oli-border rounded-xl px-3.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3 flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-oli-dark">Observações</label>
            <textarea
              name="observacoes"
              rows={2}
              placeholder="Condições de pagamento, prazo, etc."
              className="w-full border border-oli-border rounded-xl px-3.5 py-2.5 text-sm text-oli-dark bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/40 focus:border-oli-green transition-colors resize-none"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3 flex justify-end">
            <button
              type="submit"
              className="bg-oli-green text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-[#4a6454] transition-colors"
            >
              Salvar fornecedor
            </button>
          </div>
        </form>
      </div>

      {/* ── Lista ── */}
      {(suppliers ?? []).length > 0 ? (
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-oli-border">
            <h2 className="text-sm font-bold text-oli-dark">Fornecedores ativos</h2>
          </div>
          <div className="divide-y divide-oli-border">
            {(suppliers ?? []).map(s => (
              <div key={s.id} className="px-5 py-4 flex items-start gap-4">

                {/* Inicial */}
                <div className="w-10 h-10 rounded-xl bg-oli-bg flex items-center justify-center text-sm font-bold text-oli-dark shrink-0">
                  {s.nome[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-oli-dark">{s.nome}</p>
                    {s.categoria && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLOR[s.categoria] ?? CAT_COLOR['Outros']}`}>
                        {s.categoria}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {s.cnpj    && <span className="text-[11px] text-oli-lgray">CNPJ: {s.cnpj}</span>}
                    {s.contato && <span className="text-[11px] text-oli-lgray">Contato: {s.contato}</span>}
                    {s.telefone && <span className="text-[11px] text-oli-lgray">{s.telefone}</span>}
                    {s.email   && <span className="text-[11px] text-oli-lgray">{s.email}</span>}
                  </div>
                  {s.observacoes && (
                    <p className="text-[11px] text-oli-lgray italic mt-1 truncate">{s.observacoes}</p>
                  )}
                </div>

                {/* Remover */}
                <form action={deactivateSupplier}>
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    className="text-[11px] text-oli-lgray hover:text-oli-red transition-colors"
                    title="Remover fornecedor"
                  >
                    Remover
                  </button>
                </form>

              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-oli-border flex flex-col items-center justify-center py-16 text-oli-lgray">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <p className="text-sm font-semibold">Nenhum fornecedor cadastrado</p>
          <p className="text-xs mt-1">Use o formulário acima para adicionar.</p>
        </div>
      )}

    </div>
  );
}
