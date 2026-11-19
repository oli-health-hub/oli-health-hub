import type { ReservaHoje } from '@/lib/hoje-data';
import { normalizeReservationStatus, reservationStatusLabel, reservationStatusClass } from '@/lib/reservation-status';
import { fmtHora } from './format';
import PacienteForm from './PacienteForm';

export default function ReservasDoDia({
  reservas,
  rotulosDisponiveis,
}: {
  reservas: ReservaHoje[];
  rotulosDisponiveis: boolean;
}) {
  return (
    <div className="rounded-2xl border border-oli-border bg-white p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-oli-dark">Reservas do dia</h2>
        {rotulosDisponiveis && (
          <p className="text-xs text-oli-gray">Paciente: só nome e inicial. Apagado 7 dias após a reserva.</p>
        )}
      </div>

      {reservas.length === 0 ? (
        <p className="py-6 text-center text-sm text-oli-gray">Nenhuma reserva para hoje.</p>
      ) : (
        <ul className="divide-y divide-oli-border">
          {reservas.map((r) => {
            const status = normalizeReservationStatus(r.status);
            const descricao = `das ${fmtHora(r.start_time)} na ${r.room_name}`;
            return (
              <li key={r.id} className="grid gap-2 py-3 sm:grid-cols-[9rem_1fr_minmax(0,16rem)] sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-oli-dark">
                    {fmtHora(r.start_time)} – {fmtHora(r.end_time)}
                  </p>
                  <p className="text-xs text-oli-gray">{r.room_name}</p>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm text-oli-dark">{r.profissional ?? 'Profissional sem nome'}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${reservationStatusClass(status)}`}>
                    {reservationStatusLabel(status)}
                  </span>
                </div>
                {rotulosDisponiveis && (
                  <PacienteForm reservationId={r.id} initialValue={r.patient_label} descricao={descricao} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
