'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Wallet, Receipt, FileText, Truck, ChevronRight } from 'lucide-react';

type Tab = 'overview' | 'pagamentos' | 'contas' | 'fornecedores';

interface AsaasSummary {
  balance:             number;
  mrr:                 number;
  paymentsMonth:       number;
  paymentsLastMonth:   number;
  paymentsMonthCount:  number;
  activeSubsCount:     number;
  lastPayments: Array<{
    id:            string;
    value:         number;
    netValue:      number;
    customerName:  string;
    description:   string;
    confirmedDate: string | null;
    billingType:   string;
  }>;
}

interface Props {
  asaas:          AsaasSummary | null;
  asaasError:     string | null;
  receitaMinMes:  number;
  dinheiroMes:    number;
  dinheiroMesAnterior: number;
  reservasMes:    number;
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

const BILLING_LABEL: Record<string, string> = {
  CREDIT_CARD:     'Cartão',
  PIX:             'PIX',
  BOLETO:          'Boleto',
  BOLETO_BANCARIO: 'Boleto',
  UNDEFINED:       '—',
};

export function FinanceiroClient({ asaas, asaasError, receitaMinMes, dinheiroMes, dinheiroMesAnterior, reservasMes }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  const recebidoMes = (asaas?.paymentsMonth ?? 0) + dinheiroMes;
  const totalRevenueMes = recebidoMes + receitaMinMes;
  const totalRevenueLastMes = (asaas?.paymentsLastMonth ?? 0) + dinheiroMesAnterior;

  return (
    <div className="p-7 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-oli-dark">Financeiro</h1>
        <p className="text-sm text-oli-lgray mt-1">
          Receita real (Asaas + minutagem), pagamentos, contas e fornecedores.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-oli-border flex gap-1 overflow-x-auto">
        {([
          { id: 'overview',     label: 'Visão Geral',  icon: TrendingUp },
          { id: 'pagamentos',   label: 'Recebimentos',  icon: Receipt    },
          { id: 'contas',       label: 'Faturas',       icon: FileText   },
          { id: 'fornecedores', label: 'Fornecedores', icon: Truck      },
        ] as const).map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
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
        <div className="space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard
              icon={<Wallet size={18} color="#5F7D67" />}
              iconBg="#EFF4F0"
              label="Saldo Asaas"
              value={asaas ? fmtBRL(asaas.balance) : '—'}
              sub="disponível"
            />
            <KpiCard
              icon={<TrendingUp size={18} color="#3b82f6" />}
              iconBg="#EFF6FF"
              label="MRR"
              value={asaas ? fmtBRL(asaas.mrr) : '—'}
              sub={asaas ? `${asaas.activeSubsCount} assinaturas` : '—'}
            />
            <KpiCard
              icon={<Receipt size={18} color="#f97316" />}
              iconBg="#FFF7ED"
              label="Recebido este mês"
              value={fmtBRL(recebidoMes)}
              sub={asaas ? `Asaas ${fmtBRL(asaas.paymentsMonth)} · dinheiro ${fmtBRL(dinheiroMes)}` : `só dinheiro (Asaas indisponível)`}
            />
            <KpiCard
              icon={<TrendingUp size={18} color="#a855f7" />}
              iconBg="#FAF5FF"
              label="Minutagem mês"
              value={fmtBRL(receitaMinMes)}
              sub={`${reservasMes} reservas`}
            />
          </div>

          {/* Resumo do mês */}
          <div className="bg-white rounded-2xl border border-oli-border p-5">
            <h2 className="text-sm font-bold text-oli-dark mb-4">Resumo financeiro do mês</h2>
            <div className="space-y-3">
              <RevenueRow label="Receita Asaas (assinaturas + módulos + horas)" value={asaas?.paymentsMonth ?? 0} />
              <RevenueRow label="Recebido em dinheiro"                          value={dinheiroMes} />
              <RevenueRow label="Receita por minutagem"                          value={receitaMinMes} />
              <div className="pt-3 border-t border-oli-border">
                <RevenueRow label="Receita TOTAL do mês" value={totalRevenueMes} bold />
              </div>
              {totalRevenueLastMes > 0 && (
                <p className="text-[12px] text-oli-lgray pt-1">
                  Mês passado: <strong className="text-oli-dark">{fmtBRL(totalRevenueLastMes)}</strong>
                  {' '}
                  <span className={totalRevenueMes >= totalRevenueLastMes ? 'text-emerald-600' : 'text-red-500'}>
                    ({totalRevenueMes >= totalRevenueLastMes ? '+' : ''}
                    {(((totalRevenueMes - totalRevenueLastMes) / totalRevenueLastMes) * 100).toFixed(1)}%)
                  </span>
                </p>
              )}
            </div>
          </div>

          {asaasError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-[13px] text-red-700">
              <strong>Erro ao buscar dados Asaas:</strong> {asaasError}
            </div>
          )}
        </div>
      )}

      {/* ── PAGAMENTOS ── */}
      {tab === 'pagamentos' && (
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="px-5 py-3 border-b border-oli-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-oli-dark">Recebimentos confirmados (Asaas)</h2>
            <span className="text-[10px] text-oli-lgray">
              {asaas?.lastPayments.length ?? 0} pagamentos
            </span>
          </div>
          {!asaas || asaas.lastPayments.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-oli-lgray text-sm">
              Nenhum pagamento confirmado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-oli-border">
                    {['Data', 'Cliente', 'Descrição', 'Forma', 'Valor', 'Líquido'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-oli-border">
                  {asaas.lastPayments.map(p => (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 text-oli-gray text-[12px]">{fmtDate(p.confirmedDate)}</td>
                      <td className="px-4 py-3 font-semibold text-oli-dark text-[12px]">{p.customerName ?? '—'}</td>
                      <td className="px-4 py-3 text-oli-gray text-[12px]">{p.description || '—'}</td>
                      <td className="px-4 py-3 text-[10px]">
                        <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-semibold">
                          {BILLING_LABEL[p.billingType] ?? p.billingType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-oli-dark">{fmtBRL(p.value)}</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold">{fmtBRL(p.netValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-5 py-3 border-t border-oli-border bg-oli-bg flex items-center justify-between">
            <span className="text-[11px] text-oli-lgray">Dados em tempo real do Asaas</span>
            <Link href="/pagamentos" className="text-[12px] font-semibold text-oli-green hover:text-oli-green/80 flex items-center gap-1">
              Ver assinaturas DB <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* ── CONTAS ── */}
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

function KpiCard({
  icon, iconBg, label, value, sub,
}: {
  icon:   React.ReactNode;
  iconBg: string;
  label:  string;
  value:  string | number;
  sub:    string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-oli-border p-5 flex flex-col gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-oli-dark leading-none">{value}</p>
        <p className="text-[11px] font-semibold text-oli-lgray uppercase tracking-wider mt-1.5">{label}</p>
        <p className="text-[11px] text-oli-lgray mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function RevenueRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-bold text-oli-dark' : 'text-[13px] text-oli-gray'}>{label}</span>
      <span className={bold ? 'text-xl font-extrabold text-oli-green' : 'text-[13px] font-semibold text-oli-dark'}>
        {fmtBRL(value)}
      </span>
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
        className="inline-flex items-center gap-2 text-sm font-bold text-white bg-oli-green hover:bg-oli-green/90 px-5 py-2.5 rounded-xl transition-colors"
      >
        Abrir página dedicada <ChevronRight size={15} />
      </Link>
    </div>
  );
}
