'use client';

import ActionForm from '@/components/ActionForm';
import { setReservationPatientLabel } from '@/app/actions-hoje';

const INPUT =
  'h-9 w-full min-w-0 rounded-xl border border-oli-border bg-white px-3 text-sm text-oli-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-oli-green/30';
const BOTAO =
  'h-9 rounded-xl bg-oli-green px-3 text-xs font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]';

/** Campo "Paciente" de uma reserva: nome + inicial do sobrenome. Salvar vazio apaga. */
export default function PacienteForm({
  reservationId,
  initialValue,
  descricao,
}: {
  reservationId: string;
  initialValue: string | null;
  descricao: string;
}) {
  return (
    <ActionForm
      action={setReservationPatientLabel}
      submitLabel="Salvar"
      pendingLabel="Salvando…"
      resetOnSuccess={false}
      formClassName="flex items-start gap-2"
      footerClassName="shrink-0"
      buttonClassName={BOTAO}
    >
      <input type="hidden" name="reservation_id" value={reservationId} />
      <input
        type="text"
        name="patient_label"
        defaultValue={initialValue ?? ''}
        maxLength={60}
        autoComplete="off"
        placeholder="Nome e inicial do sobrenome"
        aria-label={`Paciente da reserva ${descricao}`}
        className={INPUT}
      />
    </ActionForm>
  );
}
