import Link from 'next/link';
import type { HojeData, PendenciaReserva, PendenciaAssinatura, ListaComTotal } from '@/lib/hoje-data';
import { fmtDiaHora, plural } from './format';

const LINK = 'shrink-0 text-xs font-semibold text-oli-green underline-offset-2 hover:underline';

function Resolver({ href, rotulo }: { href: string | null; rotulo: string }) {
  if (!href) return null;
  return (
    <Link href={href} className={LINK} aria-label={rotulo}>
      Resolver
    </Link>
  );
}

function Grupo({ titulo, tom, children }: { titulo: string; tom: 'red' | 'gold' | 'green'; children: React.ReactNode }) {
  const barra = tom === 'red' ? 'bg-oli-red' : tom === 'gold' ? 'bg-oli-gold' : 'bg-oli-green';
  return (
    <section className="py-3 first:pt-0 last:pb-0">
      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-oli-dark">
        <span className={`h-2 w-2 rounded-full ${barra}`} aria-hidden="true" />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Mais({ lista }: { lista: ListaComTotal<unknown> }) {
  const resto = lista.total - lista.itens.length;
  if (resto <= 0) return null;
  return <p className="mt-1 text-xs text-oli-gray">e mais {resto}</p>;
}

function ListaReservas({ lista, verbo }: { lista: ListaComTotal<PendenciaReserva>; verbo: string }) {
  return (
    <>
      <ul className="divide-y divide-oli-border">
        {lista.itens.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 text-oli-dark">
              <span className="font-medium">{r.profissional ?? 'Profissional sem nome'}</span>
              <span className="text-oli-gray">
                {' '}
                · {r.room_name} · {verbo} {fmtDiaHora(r.end_time)}
              </span>
            </span>
            <Resolver
              href={r.professional_id ? `/medicos/${r.professional_id}` : null}
              rotulo={`Abrir a ficha de ${r.profissional ?? 'profissional'}`}
            />
          </li>
        ))}
      </ul>
      <Mais lista={lista} />
    </>
  );
}

function ListaAssinaturas({ lista }: { lista: ListaComTotal<PendenciaAssinatura> }) {
  return (
    <>
      <ul className="divide-y divide-oli-border">
        {lista.itens.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 text-oli-dark">
              <span className="font-medium">{s.profissional ?? 'Profissional sem nome'}</span>
              <span className="text-oli-gray"> · termina em {fmtDiaHora(s.ends_at)}</span>
            </span>
            <Resolver
              href={s.professional_id ? `/medicos/${s.professional_id}` : null}
              rotulo={`Abrir a ficha de ${s.profissional ?? 'profissional'}`}
            />
          </li>
        ))}
      </ul>
      <Mais lista={lista} />
    </>
  );
}

export default function PendenciasCard({ data, total }: { data: HojeData; total: number }) {
  const { checkoutsAbertos, vencidasSemCheckin, assinaturasVencendo, leadsAguardando, conversasAguardando } = data;

  return (
    <div className="rounded-2xl border border-oli-border bg-white p-5">
      <h2 className="mb-3 text-sm font-bold text-oli-dark">Pendências</h2>

      {total === 0 ? (
        <p className="text-sm text-oli-gray">Nenhuma pendência. Tudo em dia.</p>
      ) : (
        <div className="divide-y divide-oli-border">
          {checkoutsAbertos.total > 0 && (
            <Grupo
              tom="red"
              titulo={`${checkoutsAbertos.total} ${plural(checkoutsAbertos.total, 'check-out aberto', 'check-outs abertos')}`}
            >
              <ListaReservas lista={checkoutsAbertos} verbo="deveria ter terminado em" />
            </Grupo>
          )}

          {vencidasSemCheckin.total > 0 && (
            <Grupo
              tom="red"
              titulo={`${vencidasSemCheckin.total} ${plural(vencidasSemCheckin.total, 'reserva vencida sem check-in', 'reservas vencidas sem check-in')}`}
            >
              <ListaReservas lista={vencidasSemCheckin} verbo="terminou em" />
            </Grupo>
          )}

          {assinaturasVencendo.total > 0 && (
            <Grupo
              tom="gold"
              titulo={`${assinaturasVencendo.total} ${plural(assinaturasVencendo.total, 'assinatura PRO termina', 'assinaturas PRO terminam')} em até 7 dias`}
            >
              <ListaAssinaturas lista={assinaturasVencendo} />
            </Grupo>
          )}

          {leadsAguardando > 0 && (
            <Grupo tom="green" titulo="Comercial">
              <div className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="text-oli-dark">
                  {leadsAguardando} {plural(leadsAguardando, 'lead novo ou sem resposta', 'leads novos ou sem resposta')}
                </span>
                <Resolver href="/comercial" rotulo="Abrir os leads" />
              </div>
            </Grupo>
          )}

          {conversasAguardando > 0 && (
            <Grupo tom="green" titulo="Conversas">
              <div className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="text-oli-dark">
                  {conversasAguardando}{' '}
                  {plural(conversasAguardando, 'conversa aguardando nossa resposta', 'conversas aguardando nossa resposta')}
                </span>
                <Resolver href="/comercial/conversas" rotulo="Abrir as conversas" />
              </div>
            </Grupo>
          )}
        </div>
      )}
    </div>
  );
}
