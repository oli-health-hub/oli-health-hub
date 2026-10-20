'use client';

import { removerHoras } from '@/app/actions';
import ActionForm from '@/components/ActionForm';

const INPUT = 'w-full text-sm border border-oli-border rounded-xl px-3 py-2 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-red';

/**
 * Remoção de horas com aviso ao cliente.
 *
 * A ação diminui o saldo do profissional e dispara um aviso, então pede confirmação
 * antes de enviar e mostra o resultado (inclusive se o push chegou) na tela.
 */
export default function RemoverHorasForm({
  professionalId,
  disponivelTexto,
  disponivelMin,
}: {
  professionalId: string;
  disponivelTexto: string;
  disponivelMin: number;
}) {
  if (disponivelMin <= 0) {
    return <p className="text-sm text-oli-lgray">Sem saldo disponível para remover.</p>;
  }

  return (
    <ActionForm
      action={removerHoras}
      formClassName="space-y-3"
      buttonClassName="w-full text-sm font-semibold px-4 py-2 rounded-xl bg-oli-red text-white hover:bg-oli-red/80 transition-colors"
      submitLabel="Remover horas e avisar o cliente"
      pendingLabel="Removendo e avisando…"
      confirmMessage="Remover estas horas do saldo e enviar o aviso ao cliente? O motivo informado será enviado a ele."
    >
      <input type="hidden" name="professional_id" value={professionalId} />

      <p className="text-xs text-oli-lgray">
        Disponível para remover: <span className="font-semibold text-oli-dark">{disponivelTexto}</span>
        {' '}(saldo não expirado; sai primeiro o pacote que vence antes).
      </p>

      <div className="flex gap-2 items-center">
        <input
          type="number"
          name="horas"
          min="0"
          step="1"
          defaultValue="0"
          aria-label="Horas a remover"
          className={INPUT}
        />
        <span className="text-xs text-oli-lgray shrink-0">h</span>
        <input
          type="number"
          name="minutos"
          min="0"
          max="59"
          step="1"
          defaultValue="0"
          aria-label="Minutos a remover"
          className={INPUT}
        />
        <span className="text-xs text-oli-lgray shrink-0">min</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="motivo-remocao" className="text-xs font-semibold text-oli-dark">
          Motivo (enviado ao cliente) *
        </label>
        <textarea
          id="motivo-remocao"
          name="motivo"
          required
          minLength={10}
          rows={3}
          placeholder="Ex.: crédito lançado em duplicidade em 12/10; ajuste combinado com a recepção."
          className={INPUT}
        />
        <span className="text-[11px] text-oli-lgray">
          Mínimo de 10 caracteres. Fica registrado no histórico de ajustes.
        </span>
      </div>
    </ActionForm>
  );
}
