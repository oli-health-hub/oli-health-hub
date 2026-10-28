'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Wallet, Receipt, FileText, Truck, ChevronRight, ChevronLeft,
  Clock, AlertTriangle, CreditCard, Hourglass,
} from 'lucide-react';
import type { FinanceiroMes, LinhaPagamento, Agrupamento } from '@/lib/financeiro';

type Tab = 'overview' | 'pagamentos' | 'aberto' | 'contas' | 'fornecedores';

const TABS = [
  { id: 'overview',     label: 'Visão Geral',  icon: TrendingUp },
  { id: 'pagamentos',   label: 'Recebimentos', icon: Receipt    },
  { id: 'aberto',       label: 'Em aberto',    icon: Hourglass  },
  { id: 'contas',       label: 'Faturas',      icon: FileText   },
  { id: 'fornecedores', label: 'Fornecedores', icon: Truck      },
] as const;

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  RECEIVED:         { label: 'Recebido',             cls: 'bg-green-50 text-green-700'   },
  CONFIRMED:        { label: 'Confirmado (a liberar)', cls: 'bg-blue-50 text-blue-700'   },
  RECEIVED_IN_CASH: { label: 'Recebido em caixa',    cls: 'bg-teal-50 text-teal-700'     },
  PENDING:          { label: 'Pendente',             cls: 'bg-yellow-50 text-yellow-700' },
  OVERDUE:          { label: 'Vencido',              cls: 'bg-red-50 text-red-700'       },
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (evita deslocamento de fuso). */
function fmtDia(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function labelMes(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .replace(/^\w/, c => c.toUpperCase());
}

function deslocar(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function FinanceiroClient({ data }: { data: FinanceiroMes }) {
  const [tab, setTab] = useState<Tab>('overview');

  const totalBruto   = data.asaasMes.bruto + data.dinheiroMes.total;
  const totalLiquido = data.asaasMes.liquido + data.dinheiroMes.total;
  const totalAnterior = data.asaasMesAnterior.bruto + data.dinheiroMesAnterior;
  const variacao = totalAnterior > 0 ? ((totalBruto - totalAnterior) / totalAnterior) * 100 : null;

  const mesProximo = deslocar(data.mes, 1);
  const podeAvancar = mesProximo <= data.hoje.slice(0, 7);

  const totalAberto = data.aReceber.total + data.vencido.total;

  return (
    <div className="p-7 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-oli-dark">Financeiro</h1>
          <p className="text-sm text-oli-lgray mt-1">
            O que entrou, o que está disponível para saque e o que ainda falta receber.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/financeiro?mes=${deslocar(data.mes, -1)}`}
            aria-label="Mês anterior"
            className="p-2 text-oli-lgray hover:text-oli-dark hover:bg-white rounded-xl border border-oli-border transition-colors"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="px-4 py-1.5 text-sm font-semibold text-oli-dark bg-white border border-oli-border rounded-xl min-w-[150px] text-center">
            {labelMes(data.mes)}
          </span>
          {podeAvancar ? (
            <Link
              href={`/financeiro?mes=${mesProximo}`}
              aria-label="Próximo mês"
              className="p-2 text-oli-lgray hover:text-oli-dark hover:bg-white rounded-xl border border-oli-border transition-colors"
            >
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span className="p-2 text-oli-lgray/40 rounded-xl border border-oli-border" aria-hidden="true">
              <ChevronRight size={16} />
            </span>
          )}
        </div>
      </div>

      {/* Avisos de leitura do Asaas */}
      {data.avisos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-[13px] text-red-700 space-y-1">
          <p className="font-bold">Parte dos dados do Asaas não pôde ser lida. Os valores abaixo estão incompletos.</p>
          {data.avisos.map(a => <p key={a} className="break-words">{a}</p>)}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-oli-border flex gap-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-label={label}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-oli-green text-oli-green'
                  : 'border-transparent text-oli-lgray hover:text-oli-dark'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── VISÃO GERAL ── */}
      {tab === 'overview' && (
        <div className="space-y-6">

          {/* Posição de hoje */}
          <section className="space-y-2.5">
            <SectionTitle title="Posição hoje" hint="Fotografia do Asaas agora; não muda com o mês escolhido." />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <KpiCard
                icon={<Wallet size={18} className="text-oli-green" />}
                iconBg="bg-green-50"
                label="Disponível para saque"
                value={data.saldoDisponivel === null ? '—' : fmtBRL(data.saldoDisponivel)}
                sub="saldo atual da conta Asaas"
              />
              <KpiCard
                icon={<CreditCard size={18} className="text-blue-500" />}
                iconBg="bg-blue-50"
                label="A liberar (cartão)"
                value={fmtBRL(data.aLiberar.liquido)}
                sub={`${data.aLiberar.count} pagamento${data.aLiberar.count !== 1 ? 's' : ''} pago${data.aLiberar.count !== 1 ? 's' : ''}, ainda fora do saldo (líquido)`}
              />
              <KpiCard
                icon={<Clock size={18} className="text-yellow-600" />}
                iconBg="bg-yellow-50"
                label="A receber"
                value={fmtBRL(data.aReceber.total)}
                sub={`${data.aReceber.count} cobrança${data.aReceber.count !== 1 ? 's' : ''} no prazo · ${fmtBRL(data.aReceber.vencemNoMesAtual)} vence este mês`}
              />
              <KpiCard
                icon={<AlertTriangle size={18} className="text-red-500" />}
                iconBg="bg-red-50"
                label="Vencido"
                value={fmtBRL(data.vencido.total)}
                sub={`${data.vencido.count} cobrança${data.vencido.count !== 1 ? 's' : ''} em atraso`}
                alerta={data.vencido.total > 0}
              />
            </div>
          </section>

          {/* Mês escolhido */}
          <section className="space-y-2.5">
            <SectionTitle
              title={`Recebido em ${labelMes(data.mes)}`}
              hint={data.mesEhAtual ? 'Mês em andamento: valores parciais até hoje.' : 'Mês fechado.'}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <KpiCard
                icon={<Receipt size={18} className="text-orange-500" />}
                iconBg="bg-orange-50"
                label="Total recebido"
                value={fmtBRL(totalBruto)}
                sub={`líquido de taxas ${fmtBRL(totalLiquido)}`}
              />
              <KpiCard
                icon={<TrendingUp size={18} className="text-oli-green" />}
                iconBg="bg-green-50"
                label="Via Asaas"
                value={fmtBRL(data.asaasMes.bruto)}
                sub={`${data.asaasMes.count} pagamento${data.asaasMes.count !== 1 ? 's' : ''} · taxas ${fmtBRL(data.asaasMes.taxas)}`}
              />
              <KpiCard
                icon={<Wallet size={18} className="text-teal-600" />}
                iconBg="bg-teal-50"
                label="Em dinheiro"
                value={fmtBRL(data.dinheiroMes.total)}
                sub={`${data.dinheiroMes.count} lançamento${data.dinheiroMes.count !== 1 ? 's' : ''} manual${data.dinheiroMes.count !== 1 ? 'is' : ''}`}
              />
              <KpiCard
                icon={<TrendingUp size={18} className="text-purple-500" />}
                iconBg="bg-purple-50"
                label="Receita recorrente (MRR)"
                value={fmtBRL(data.mrr)}
                sub={`${data.assinaturasPagas} assinatura${data.assinaturasPagas !== 1 ? 's' : ''} paga${data.assinaturasPagas !== 1 ? 's' : ''} ativa${data.assinaturasPagas !== 1 ? 's' : ''}`}
              />
            </div>
          </section>

          {/* Resumo + detalhamento */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-oli-border p-5">
              <h2 className="text-sm font-bold text-oli-dark mb-4">Do bruto ao líquido</h2>
              <div className="space-y-3">
                <Row label="Recebido via Asaas (bruto)" value={data.asaasMes.bruto} />
                <Row label="(−) Taxas do Asaas"          value={-data.asaasMes.taxas} muted />
                <Row label="Asaas líquido"               value={data.asaasMes.liquido} />
                <Row label="(+) Recebido em dinheiro"    value={data.dinheiroMes.total} />
                <div className="pt-3 border-t border-oli-border space-y-3">
                  <Row label="Total recebido (bruto)"  value={totalBruto} bold />
                  <Row label="Total líquido de taxas"  value={totalLiquido} />
                </div>
                {data.estornadoMes.count > 0 && (
                  <p className="text-[12px] text-red-600 pt-1">
                    Fora da conta: {data.estornadoMes.count} estorno{data.estornadoMes.count !== 1 ? 's' : ''} de {fmtBRL(data.estornadoMes.total)} no mês.
                  </p>
                )}
                {totalAnterior > 0 && (
                  <p className="text-[12px] text-oli-lgray pt-1">
                    {labelMes(data.mesAnterior)}: <strong className="text-oli-dark">{fmtBRL(totalAnterior)}</strong>
                    {variacao !== null && (
                      <span className={variacao >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {' '}({variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%)
                      </span>
                    )}
                    {data.mesEhAtual && ' · mês atual ainda em andamento'}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-oli-border p-5 space-y-5">
              <Breakdown titulo="Recebido por origem" itens={data.porOrigem} total={data.asaasMes.bruto} />
              <Breakdown titulo="Recebido por forma de pagamento" itens={data.porForma} total={data.asaasMes.bruto} />
              <p className="text-[11px] text-oli-lgray">Apenas Asaas. Dinheiro registrado manualmente não entra neste detalhamento.</p>
            </div>
          </div>

          {/* Consumo: não é caixa */}
          <div className="bg-white rounded-2xl border border-oli-border p-5">
            <h2 className="text-sm font-bold text-oli-dark mb-1">Uso de salas no mês (não é entrada de caixa)</h2>
            <p className="text-[12px] text-oli-lgray mb-4">
              Consumo apurado nas sessões. Fica fora do total recebido porque o pacote de horas já foi pago no Asaas
              quando foi comprado; somar os dois contaria o mesmo dinheiro duas vezes.
            </p>
            <div className="space-y-3">
              <Row label={`Minutagem apurada (${data.minutagemSessoes} sessões)`} value={data.minutagemMes} />
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-oli-gray">Reservas no mês</span>
                <span className="text-[13px] font-semibold text-oli-dark">{data.reservasMes}</span>
              </div>
            </div>
          </div>

          {/* Glossário */}
          <div className="bg-oli-bg rounded-2xl border border-oli-border p-5">
            <h2 className="text-sm font-bold text-oli-dark mb-3">Como ler estes números</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 text-[12px] text-oli-gray">
              <Termo t="Recebido" d="O cliente pagou no mês (data do pagamento). Inclui cartão ainda não liberado." />
              <Termo t="Disponível" d="Saldo da conta Asaas hoje, pronto para saque. É menor que o recebido: desconta taxas e saques." />
              <Termo t="A liberar" d="Cartão já pago pelo cliente, mas que o Asaas ainda não creditou no saldo (até 32 dias)." />
              <Termo t="A receber / Vencido" d="Cobranças emitidas e não pagas, dentro do prazo ou em atraso. Valor bruto." />
              <Termo t="Bruto × líquido" d="Bruto é o que o cliente pagou. Líquido é o que fica depois da taxa do Asaas." />
              <Termo t="MRR" d="Assinaturas pagas ativas, normalizadas para um mês (semestral ÷ 6, anual ÷ 12)." />
            </dl>
            <p className="text-[11px] text-oli-lgray mt-3">Dados do Asaas com cache de até 5 minutos.</p>
          </div>
        </div>
      )}

      {/* ── RECEBIMENTOS ── */}
      {tab === 'pagamentos' && (
        <TabelaPagamentos
          titulo={`Recebimentos de ${labelMes(data.mes)}`}
          vazio="Nenhum recebimento no mês"
          colunaData="Pago em"
          linhas={data.recebimentos}
          rodape={`${data.recebimentos.length} pagamentos · bruto ${fmtBRL(data.asaasMes.bruto)} · líquido ${fmtBRL(data.asaasMes.liquido)}`}
          nota={
            <>
              Só Asaas. Dinheiro registrado fica em{' '}
              <Link href="/recebimentos" className="font-semibold text-oli-green hover:underline">Recebimentos em dinheiro</Link>.
            </>
          }
        />
      )}

      {/* ── EM ABERTO ── */}
      {tab === 'aberto' && (
        <TabelaPagamentos
          titulo="Cobranças em aberto"
          vazio="Nenhuma cobrança em aberto"
          colunaData="Vencimento"
          linhas={data.emAberto}
          hoje={data.hoje}
          rodape={`${data.emAberto.length} cobranças · ${fmtBRL(totalAberto)} (vencido ${fmtBRL(data.vencido.total)})`}
          nota={<>Líquido ainda não definido: a taxa só é conhecida quando o cliente paga.</>}
          ocultarLiquido
        />
      )}

      {/* ── FATURAS ── */}
      {tab === 'contas' && (
        <ExternalRedirect
          title="Faturas / Contas a Receber"
          description="Cobranças por vencimento: assinaturas, avulsos, despesas operacionais."
          href="/contas"
        />
      )}

      {/* ── FORNECEDORES ── */}
      {tab === 'fornecedores' && (
        <ExternalRedirect
          title="Fornecedores"
          description="Cadastro e gestão de fornecedores para contas a pagar."
          href="/fornecedores"
        />
      )}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between flex-wrap gap-x-4">
      <h2 className="text-sm font-bold text-oli-dark">{title}</h2>
      <span className="text-[11px] text-oli-lgray">{hint}</span>
    </div>
  );
}

function KpiCard({
  icon, iconBg, label, value, sub, alerta,
}: {
  icon:    React.ReactNode;
  iconBg:  string;
  label:   string;
  value:   string;
  sub:     string;
  alerta?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 ${alerta ? 'border-red-200' : 'border-oli-border'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-extrabold leading-none ${alerta ? 'text-red-600' : 'text-oli-dark'}`}>{value}</p>
        <p className="text-[11px] font-semibold text-oli-lgray uppercase tracking-wider mt-1.5">{label}</p>
        <p className="text-[11px] text-oli-lgray mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={bold ? 'font-bold text-oli-dark' : 'text-[13px] text-oli-gray'}>{label}</span>
      <span
        className={
          bold  ? 'text-xl font-extrabold text-oli-green'
          : muted ? 'text-[13px] font-semibold text-red-500'
          : 'text-[13px] font-semibold text-oli-dark'
        }
      >
        {fmtBRL(value)}
      </span>
    </div>
  );
}

function Termo({ t, d }: { t: string; d: string }) {
  return (
    <div>
      <dt className="inline font-bold text-oli-dark">{t}: </dt>
      <dd className="inline">{d}</dd>
    </div>
  );
}

function Breakdown({ titulo, itens, total }: { titulo: string; itens: Agrupamento[]; total: number }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider mb-2.5">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-[12px] text-oli-lgray">Sem recebimentos no mês</p>
      ) : (
        <div className="space-y-2.5">
          {itens.map(i => {
            const pct = total > 0 ? Math.round((i.bruto / total) * 100) : 0;
            return (
              <div key={i.chave}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="text-oli-dark font-semibold">
                    {i.chave} <span className="text-oli-lgray font-normal">· {i.count}</span>
                  </span>
                  <span className="text-oli-dark font-semibold">{fmtBRL(i.bruto)} <span className="text-oli-lgray font-normal">({pct}%)</span></span>
                </div>
                <progress className="barra" value={pct} max={100} aria-label={`${i.chave}: ${pct}%`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabelaPagamentos({
  titulo, vazio, colunaData, linhas, rodape, nota, hoje, ocultarLiquido,
}: {
  titulo:          string;
  vazio:           string;
  colunaData:      string;
  linhas:          LinhaPagamento[];
  rodape:          string;
  nota:            React.ReactNode;
  hoje?:           string;
  ocultarLiquido?: boolean;
}) {
  const colunas = ['Data', 'Cliente', 'Origem', 'Forma', 'Status', 'Bruto', ...(ocultarLiquido ? [] : ['Líquido'])];
  return (
    <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
      <div className="px-5 py-3 border-b border-oli-border flex items-center justify-between">
        <h2 className="text-sm font-bold text-oli-dark">{titulo}</h2>
        <span className="text-[10px] text-oli-lgray">{colunaData}</span>
      </div>
      {linhas.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-oli-lgray text-sm">{vazio}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oli-border">
                {colunas.map((h, i) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider whitespace-nowrap">
                    {i === 0 ? colunaData : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-oli-border">
              {linhas.map(l => {
                const st = STATUS_LABEL[l.status] ?? { label: l.status, cls: 'bg-gray-100 text-gray-500' };
                const atrasada = !!hoje && l.data < hoje;
                return (
                  <tr key={l.id} className="hover:bg-stone-50 transition-colors">
                    <td className={`px-4 py-3 text-[12px] whitespace-nowrap ${atrasada ? 'text-red-600 font-semibold' : 'text-oli-gray'}`}>{fmtDia(l.data)}</td>
                    <td className="px-4 py-3 font-semibold text-oli-dark text-[12px]">{l.cliente}</td>
                    <td className="px-4 py-3 text-oli-gray text-[12px] whitespace-nowrap">{l.origem}</td>
                    <td className="px-4 py-3 text-[10px]">
                      <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-semibold">{l.forma}</span>
                    </td>
                    <td className="px-4 py-3 text-[10px] whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-oli-dark whitespace-nowrap">{fmtBRL(l.bruto)}</td>
                    {!ocultarLiquido && (
                      <td className="px-4 py-3 text-emerald-600 font-semibold whitespace-nowrap">{fmtBRL(l.liquido)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-3 border-t border-oli-border bg-oli-bg flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] font-semibold text-oli-dark">{rodape}</span>
        <span className="text-[11px] text-oli-lgray">{nota}</span>
      </div>
    </div>
  );
}

function ExternalRedirect({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <div className="bg-white rounded-2xl border border-oli-border p-8 text-center">
      <h2 className="text-base font-bold text-oli-dark mb-2">{title}</h2>
      <p className="text-sm text-oli-lgray mb-5 max-w-md mx-auto">{description}</p>
      <Link
        href={href}
        aria-label={`Abrir ${title}`}
        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-oli-green hover:bg-oli-green/90 px-5 py-2.5 rounded-xl transition-colors"
      >
        Abrir página dedicada <ChevronRight size={15} />
      </Link>
    </div>
  );
}
