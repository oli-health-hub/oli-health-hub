import { saveAsaasAccountDraft } from '@/app/actions';

interface Props {
  professionalId: string;
  account: {
    tipo_pessoa:   string | null;
    nome_completo: string | null;
    email:         string | null;
    telefone:      string | null;
    status:        string;
    status_reason: string | null;
  } | null;
}

const STATUS_META: Record<string, { label: string; bg: string }> = {
  rascunho:             { label: 'Rascunho — ainda não enviado',      bg: 'bg-gray-100 text-gray-600' },
  aguardando_aprovacao: { label: 'Aguardando aprovação da Asaas',     bg: 'bg-yellow-50 text-yellow-700' },
  aprovada:             { label: 'Aprovada — pronta para cobrar',     bg: 'bg-green-50 text-oli-green' },
  rejeitada:            { label: 'Rejeitada pela Asaas',              bg: 'bg-red-50 text-oli-red' },
  suspensa:             { label: 'Suspensa',                          bg: 'bg-red-50 text-oli-red' },
};

export function AsaasAccountCard({ professionalId, account }: Props) {
  const status = account?.status ?? 'rascunho';
  const meta   = STATUS_META[status] ?? STATUS_META.rascunho;
  const editavel = status === 'rascunho';

  return (
    <div className="bg-white rounded-2xl border border-oli-border p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-oli-dark">Conta Asaas do médico</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg}`}>{meta.label}</span>
      </div>
      <p className="text-xs text-oli-lgray mb-4">
        Subconta Asaas própria — cobrança de paciente cai direto nela, a OLI não é intermediária recebedora.
        Envio real para a Asaas ainda não está ativo (pendente de confirmação com o comercial deles).
      </p>

      {!editavel && account?.status_reason && (
        <p className="text-xs text-oli-red mb-3">{account.status_reason}</p>
      )}

      {editavel ? (
        <form action={saveAsaasAccountDraft} className="space-y-3">
          <input type="hidden" name="professional_id" value={professionalId} />
          <select
            name="tipo_pessoa"
            defaultValue={account?.tipo_pessoa ?? ''}
            required
            className="w-full text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark bg-white focus:outline-none focus:ring-1 focus:ring-oli-green"
          >
            <option value="">Pessoa física ou jurídica…</option>
            <option value="pf">Pessoa física (autônomo)</option>
            <option value="pj">Pessoa jurídica</option>
          </select>
          <input
            type="text" name="nome_completo" required placeholder="Nome completo / razão social"
            defaultValue={account?.nome_completo ?? ''}
            className="w-full text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
          />
          <input
            type="email" name="email" required placeholder="E-mail para a subconta"
            defaultValue={account?.email ?? ''}
            className="w-full text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
          />
          <input
            type="text" name="telefone" placeholder="Telefone"
            defaultValue={account?.telefone ?? ''}
            className="w-full text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
          />
          <button type="submit" className="w-full text-sm font-semibold px-4 py-2 rounded-xl bg-oli-green text-white hover:bg-oli-green/80 transition-colors">
            Salvar dados
          </button>
          <p className="text-[10px] text-oli-lgray">
            CPF/CNPJ não é pedido aqui — só será solicitado no envio real para a Asaas, quando essa etapa estiver disponível.
          </p>
        </form>
      ) : (
        <div className="space-y-0">
          <div className="flex items-start gap-2 py-2 border-b border-oli-border/60">
            <span className="text-xs text-oli-lgray w-32 shrink-0">Nome / razão</span>
            <span className="text-sm text-oli-dark">{account?.nome_completo ?? '—'}</span>
          </div>
          <div className="flex items-start gap-2 py-2 border-b border-oli-border/60 last:border-0">
            <span className="text-xs text-oli-lgray w-32 shrink-0">E-mail</span>
            <span className="text-sm text-oli-dark">{account?.email ?? '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
