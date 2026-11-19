import FilaClient, { type QueueItem } from '@/components/FilaClient';

/** As notificações operacionais que a antiga Fila mostrava (cadastros, reservas, planos, módulos, horas). */
export default function AtividadeRecente({ itens }: { itens: QueueItem[] }) {
  return (
    <section aria-labelledby="atividade-recente">
      <h2 id="atividade-recente" className="mb-3 text-sm font-bold text-oli-dark">
        Atividade recente
      </h2>
      <FilaClient initialItems={itens} />
    </section>
  );
}
