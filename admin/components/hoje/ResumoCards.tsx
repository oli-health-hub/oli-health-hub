import Link from 'next/link';
import { CalendarDays, AlertTriangle, DoorOpen, MessageCircle, type LucideIcon } from 'lucide-react';
import type { HojeData } from '@/lib/hoje-data';
import { normalizeReservationStatus } from '@/lib/reservation-status';
import { fmtHora, plural } from './format';

type Tom = 'green' | 'gold' | 'red' | 'neutral';

const TOM: Record<Tom, { icone: string; faixa: string }> = {
  green: { icone: 'bg-oli-green/10 text-oli-green', faixa: 'bg-oli-green' },
  gold: { icone: 'bg-oli-gold/15 text-oli-gold', faixa: 'bg-oli-gold' },
  red: { icone: 'bg-oli-red/10 text-oli-red', faixa: 'bg-oli-red' },
  neutral: { icone: 'bg-gray-100 text-oli-gray', faixa: 'bg-oli-border' },
};

function Cartao({
  href,
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  tom,
}: {
  href: string;
  rotulo: string;
  valor: string;
  detalhe: string;
  icone: LucideIcon;
  tom: Tom;
}) {
  const t = TOM[tom];
  return (
    <Link
      href={href}
      aria-label={`${rotulo}: ${valor}. ${detalhe}`}
      className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-oli-border bg-white p-4 transition-transform duration-150 ease-out active:scale-[0.98]"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${t.faixa}`} aria-hidden="true" />
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.icone}`} aria-hidden="true">
        <Icone className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-oli-lgray">{rotulo}</span>
        <span className="block text-[28px] font-extrabold leading-none text-oli-dark">{valor}</span>
        <span className="mt-1 block truncate text-xs text-oli-gray">{detalhe}</span>
      </span>
    </Link>
  );
}

export default function ResumoCards({ data, pendencias, agora }: { data: HojeData; pendencias: number; agora: Date }) {
  const { reservas, salas } = data;
  const emSessao = reservas.filter((r) => normalizeReservationStatus(r.status) === 'em_uso').length;
  const proxima = reservas.find(
    (r) => normalizeReservationStatus(r.status) === 'agendado' && new Date(r.start_time) > agora,
  );
  const livres = salas.filter((s) => !s.emUso).length;
  const aguardando = data.leadsAguardando + data.conversasAguardando;

  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
      <Cartao
        href="#reservas-do-dia"
        rotulo="Reservas hoje"
        valor={String(reservas.length)}
        detalhe={proxima ? `Próxima às ${fmtHora(proxima.start_time)}` : emSessao > 0 ? `${emSessao} em sessão agora` : 'Sem próximas'}
        icone={CalendarDays}
        tom="green"
      />
      <Cartao
        href="#pendencias"
        rotulo="Pendências"
        valor={String(pendencias)}
        detalhe={pendencias === 0 ? 'Tudo em dia' : `${plural(pendencias, 'item pede', 'itens pedem')} atenção`}
        icone={AlertTriangle}
        tom={pendencias === 0 ? 'green' : 'red'}
      />
      <Cartao
        href="#salas-agora"
        rotulo="Salas livres"
        valor={salas.length === 0 ? '0' : `${livres}/${salas.length}`}
        detalhe={salas.length - livres > 0 ? `${salas.length - livres} em uso agora` : 'Nenhuma em uso'}
        icone={DoorOpen}
        tom={salas.length > 0 && livres === 0 ? 'gold' : 'green'}
      />
      <Cartao
        href="/comercial/conversas"
        rotulo="Aguardando resposta"
        valor={String(aguardando)}
        detalhe={`${data.leadsAguardando} ${plural(data.leadsAguardando, 'lead', 'leads')} · ${data.conversasAguardando} ${plural(data.conversasAguardando, 'conversa', 'conversas')}`}
        icone={MessageCircle}
        tom={aguardando > 0 ? 'gold' : 'neutral'}
      />
    </div>
  );
}
