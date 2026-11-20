import { Clock } from 'lucide-react';
import type { ReservaHoje } from '@/lib/hoje-data';
import { normalizeReservationStatus, reservationStatusLabel, reservationStatusClass } from '@/lib/reservation-status';
import type { ReservationStatusKey } from '@/lib/reservation-status';
import { fmtHora } from './format';
import PacienteForm from './PacienteForm';

const FAIXA: Record<ReservationStatusKey, string> = {
  agendado: 'bg-blue-400',
  em_uso: 'bg-oli-green',
  concluido: 'bg-gray-300',
  cancelado: 'bg-oli-red',
  nao_compareceu: 'bg-orange-400',
  desconhecido: 'bg-gray-300',
};

function inicial(nome: string | null): string {
  return (nome?.trim().charAt(0) || '?').toUpperCase();
}

export default function ReservasDoDia({
  reservas,
  rotulosDisponiveis,
}: {
  reservas: ReservaHoje[];
  rotulosDisponiveis: boolean;
}) {
  return (
    <section
      id="reservas-do-dia"
      aria-labelledby="reservas-do-dia-titulo"
      className="scroll-mt-4 rounded-2xl border border-oli-border bg-white p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="reservas-do-dia-titulo" className="text-sm font-bold text-oli-dark">
          Reservas do dia
        </h2>
        {rotulosDisponiveis && (
          <p className="text-xs text-oli-gray">Paciente: só nome e inicial. Apagado 7 dias após a reserva.</p>
        )}
      </div>

      {reservas.length === 0 ? (
        <p className="py-6 text-center text-sm text-oli-gray">Nenhuma reserva para hoje.</p>
      ) : (
        <ul className="space-y-2">
          {reservas.map((r) => {
            const status = normalizeReservationStatus(r.status);
            const descricao = `das ${fmtHora(r.start_time)} na ${r.room_name}`;
            return (
              <li
                key={r.id}
                className="relative grid gap-2 overflow-hidden rounded-xl border border-oli-border bg-oli-bg/40 py-3 pl-5 pr-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,15rem)] sm:items-center"
              >
                <span className={`absolute inset-y-0 left-0 w-1.5 ${FAIXA[status]}`} aria-hidden="true" />
                <div className="flex items-center gap-1.5 text-sm font-bold text-oli-dark">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-oli-lgray" aria-hidden="true" />
                  {fmtHora(r.start_time)} – {fmtHora(r.end_time)}
                </div>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oli-green/15 text-xs font-bold text-oli-green"
                    aria-hidden="true"
                  >
                    {inicial(r.profissional)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-oli-dark">{r.profissional ?? 'Profissional sem nome'}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-oli-gray">
                      <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-oli-dark ring-1 ring-oli-border">
                        {r.room_name}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${reservationStatusClass(status)}`}>
                        {reservationStatusLabel(status)}
                      </span>
                    </p>
                  </div>
                </div>
                {rotulosDisponiveis && (
                  <PacienteForm reservationId={r.id} initialValue={r.patient_label} descricao={descricao} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
