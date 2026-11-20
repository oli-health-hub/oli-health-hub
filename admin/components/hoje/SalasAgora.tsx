import { DoorOpen, DoorClosed } from 'lucide-react';
import type { SalaHoje } from '@/lib/hoje-data';
import { Painel } from '@/components/ui';
import { fmtHora } from './format';

export default function SalasAgora({ salas }: { salas: SalaHoje[] }) {
  return (
    <div id="salas-agora" className="scroll-mt-4">
      <Painel titulo="Salas agora" icone={DoorOpen} tom="green">
      {salas.length === 0 ? (
        <p className="text-sm text-oli-gray">Nenhuma sala cadastrada.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {salas.map((s) => {
            const emUso = s.emUso;
            const Icone = emUso ? DoorClosed : DoorOpen;
            return (
              <li
                key={s.id}
                className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                  emUso ? 'border-oli-gold/40 bg-oli-gold/10' : 'border-oli-green/30 bg-oli-green/10'
                }`}
              >
                <Icone
                  className={`mt-0.5 h-4 w-4 shrink-0 ${emUso ? 'text-oli-gold' : 'text-oli-green'}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-oli-dark">{s.name}</p>
                  <p className="truncate text-xs text-oli-gray">
                    {emUso
                      ? `Em uso${emUso.profissional ? ` · ${emUso.profissional}` : ''} até ${fmtHora(emUso.ate)}`
                      : 'Livre'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </Painel>
    </div>
  );
}
