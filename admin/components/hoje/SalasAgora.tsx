import type { SalaHoje } from '@/lib/hoje-data';
import { fmtHora } from './format';

export default function SalasAgora({ salas }: { salas: SalaHoje[] }) {
  return (
    <div className="rounded-2xl border border-oli-border bg-white p-5">
      <h2 className="mb-3 text-sm font-bold text-oli-dark">Salas agora</h2>
      {salas.length === 0 ? (
        <p className="text-sm text-oli-gray">Nenhuma sala cadastrada.</p>
      ) : (
        <ul className="grid gap-2">
          {salas.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-oli-bg px-3 py-2 text-sm">
              <span className="font-medium text-oli-dark">{s.name}</span>
              {s.emUso ? (
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-oli-dark">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-oli-gold" aria-hidden="true" />
                  <span className="truncate">
                    Em uso{s.emUso.profissional ? ` · ${s.emUso.profissional}` : ''} até {fmtHora(s.emUso.ate)}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-oli-gray">
                  <span className="h-2 w-2 rounded-full bg-oli-green" aria-hidden="true" />
                  Livre
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
