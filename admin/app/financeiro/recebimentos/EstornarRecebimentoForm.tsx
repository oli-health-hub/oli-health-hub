'use client';

import { estornarRecebimento } from '@/app/actions';
import ActionForm from '@/components/ActionForm';

/**
 * Estorno de recebimento em dinheiro. Desfaz a ativação (plano ou horas) e tira o
 * valor do fluxo de caixa; por isso pede o motivo e uma confirmação.
 */
export default function EstornarRecebimentoForm({ id, tipo }: { id: string; tipo: 'plano' | 'pacote_horas' }) {
  const efeito = tipo === 'plano'
    ? 'a assinatura será cancelada e o profissional volta ao plano anterior'
    : 'as horas ainda não usadas deste pacote serão retiradas do saldo';

  return (
    <ActionForm
      action={estornarRecebimento}
      formClassName="flex flex-wrap items-center gap-1.5"
      buttonClassName="text-[11px] font-semibold px-2 py-1 rounded-lg border border-oli-red text-oli-red hover:bg-red-50 transition-colors"
      submitLabel="Estornar"
      pendingLabel="Estornando…"
      confirmMessage={`Estornar este recebimento? ${efeito}, e o valor sai do fluxo de caixa.`}
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="motivo"
        required
        minLength={5}
        placeholder="Motivo do estorno"
        aria-label="Motivo do estorno"
        className="w-40 text-xs border border-oli-border rounded-lg px-2 py-1 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-red"
      />
    </ActionForm>
  );
}
