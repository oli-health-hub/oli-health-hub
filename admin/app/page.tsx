import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import { carregarHoje } from '@/lib/hoje-data';
import { contarPendencias } from '@/lib/hoje';
import { registrarVisualizacaoUmaVezPorDia } from '@/lib/audit';
import PendenciasCard from '@/components/hoje/PendenciasCard';
import ReservasDoDia from '@/components/hoje/ReservasDoDia';
import SalasAgora from '@/components/hoje/SalasAgora';
import AtividadeRecente from '@/components/hoje/AtividadeRecente';
import { fmtDiaPorExtenso, plural } from '@/components/hoje/format';

export const dynamic = 'force-dynamic';

export default async function HojePage() {
  const agora = new Date();
  const data = await carregarHoje(agora);

  // LGPD: registra (no máximo uma vez por dia por admin) que a recepção viu rótulos de paciente.
  const sessao = await createSupabaseServer();
  const { data: { user } } = await sessao.auth.getUser();
  const comRotulo = data.reservas.filter((r) => r.patient_label).length;
  if (user) await registrarVisualizacaoUmaVezPorDia(user.id, comRotulo);

  const pendencias = contarPendencias({
    checkouts: data.checkoutsAbertos.total,
    vencidas: data.vencidasSemCheckin.total,
    assinaturas: data.assinaturasVencendo.total,
    leads: data.leadsAguardando,
    conversas: data.conversasAguardando,
  });
  const nReservas = data.reservas.length;

  return (
    <div className="space-y-5 p-4 md:p-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Hoje</h1>
          <p className="text-sm text-oli-gray">
            {fmtDiaPorExtenso(agora)} · {nReservas} {plural(nReservas, 'reserva', 'reservas')} · {pendencias}{' '}
            {plural(pendencias, 'pendência', 'pendências')}
          </p>
        </div>
        <Link
          href="/configuracoes/totem"
          className="rounded-xl border border-oli-border bg-white px-3 py-2 text-xs font-semibold text-oli-dark transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Abrir Totem QR
        </Link>
      </header>

      {data.avisos.length > 0 && (
        <div role="alert" className="rounded-xl border border-oli-gold/40 bg-oli-gold/10 px-4 py-3 text-xs text-oli-dark">
          {data.avisos.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      )}

      <PendenciasCard data={data} total={pendencias} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ReservasDoDia reservas={data.reservas} rotulosDisponiveis={data.rotulosDisponiveis} />
        <SalasAgora salas={data.salas} />
      </div>

      <AtividadeRecente itens={data.atividade} />
    </div>
  );
}
