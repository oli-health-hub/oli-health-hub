import Link from 'next/link';
import { LayoutDashboard, UserRound, Crown, Activity, ShieldCheck, type LucideIcon } from 'lucide-react';

export type AbaId = 'resumo' | 'cadastro' | 'plano' | 'atividade' | 'conta';

const ICONES: Record<AbaId, LucideIcon> = {
  resumo: LayoutDashboard,
  cadastro: UserRound,
  plano: Crown,
  atividade: Activity,
  conta: ShieldCheck,
};

/** Abas da ficha do profissional. Links (`?aba=`), não estado: cada aba tem endereço próprio e a página segue como server component. */
export default function FichaAbas({
  profissionalId,
  abas,
  atual,
}: {
  profissionalId: string;
  abas: { id: AbaId; label: string; contagem?: number }[];
  atual: AbaId;
}) {
  return (
    <nav aria-label="Seções da ficha" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1.5 rounded-2xl border border-oli-border bg-white p-1.5 md:w-auto">
        {abas.map((a) => {
          const Icone = ICONES[a.id];
          const ativa = a.id === atual;
          return (
            <li key={a.id}>
              <Link
                href={a.id === 'resumo' ? `/medicos/${profissionalId}` : `/medicos/${profissionalId}?aba=${a.id}`}
                aria-current={ativa ? 'page' : undefined}
                scroll={false}
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ${
                  ativa ? 'bg-oli-green text-white' : 'text-oli-gray hover:bg-oli-bg hover:text-oli-dark'
                }`}
              >
                <Icone className="h-4 w-4" aria-hidden="true" />
                {a.label}
                {a.contagem !== undefined && a.contagem > 0 && (
                  <span className={`rounded-full px-1.5 text-[11px] ${ativa ? 'bg-white/25' : 'bg-oli-bg'}`}>{a.contagem}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
