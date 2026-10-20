'use client';

import type { FormEvent } from 'react';
import { estornarRecebimento } from '@/app/actions';

/**
 * Estorno de recebimento em dinheiro. Desfaz a ativação (plano ou horas) e tira o
 * valor do fluxo de caixa; por isso pede o motivo e uma confirmação.
 */
export default function EstornarRecebimentoForm({ id, tipo }: { id: string; tipo: 'plano' | 'pacote_horas' }) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const efeito = tipo === 'plano'
      ? 'o plano PRO será cancelado e o profissional volta ao plano anterior'
      : 'as horas ainda não usadas deste pacote serão retiradas do saldo';
    const ok = window.confirm(`Estornar este recebimento? ${efeito}, e o valor sai do fluxo de caixa.`);
    if (!ok) e.preventDefault();
  };

  return (
    <form action={estornarRecebimento} onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input
        name="motivo"
        required
        minLength={5}
        placeholder="Motivo do estorno"
        aria-label="Motivo do estorno"
        className="w-40 text-xs border border-oli-border rounded-lg px-2 py-1 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-red"
      />
      <button
        type="submit"
        className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-oli-red text-oli-red hover:bg-red-50 transition-colors"
      >
        Estornar
      </button>
    </form>
  );
}
