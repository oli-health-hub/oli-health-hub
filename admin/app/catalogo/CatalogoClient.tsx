'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Layers, Puzzle, Clock, ChevronRight, ExternalLink } from 'lucide-react';

type Tab = 'planos' | 'modulos' | 'horas';

interface Plan { id: string; name: string; preco_mensal: number; preco_anual: number; taxa_min: number; ativo: boolean }
interface ModuleRow { id: string; nome: string; descricao: string | null; valor: number; tipo: string; categoria: string; ativo: boolean }
interface HourPkg { id: string; nome: string; horas: number; valor: number; validade_dias: number; ativo: boolean }

interface Props {
  plans:   Plan[];
  modules: ModuleRow[];
  hours:   HourPkg[];
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

const CATEGORIA_LABEL: Record<string, string> = {
  tecnologia: 'Tecnologia',
  juridico:   'Jurídico',
  contabil:   'Contábil',
  convenios:  'Convênios',
  carreira:   'Carreira',
  bpo:        'BPO',
};

export function CatalogoClient({ plans, modules, hours }: Props) {
  const [tab, setTab] = useState<Tab>('planos');

  return (
    <div className="p-7 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-oli-dark">Catálogo</h1>
        <p className="text-sm text-oli-lgray mt-1">
          Planos de assinatura, módulos avulsos e pacotes de horas disponíveis para venda.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-oli-border flex gap-1 overflow-x-auto">
        {([
          { id: 'planos',  label: 'Planos',           icon: Layers },
          { id: 'modulos', label: 'Módulos',          icon: Puzzle },
          { id: 'horas',   label: 'Pacotes de Horas', icon: Clock  },
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

      {/* ── PLANOS ── */}
      {tab === 'planos' && (
        <div className="space-y-3">
          <p className="text-[12px] text-oli-lgray">
            {plans.length} planos configurados. Edição completa em <Link href="/planos" className="text-oli-green font-semibold">/planos</Link>.
          </p>
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Plano', 'Mensal', 'Anual', 'Min', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {plans.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-oli-dark">{p.name}</td>
                    <td className="px-4 py-3 text-oli-gray">{Number(p.preco_mensal) > 0 ? fmtBRL(Number(p.preco_mensal)) : '—'}</td>
                    <td className="px-4 py-3 text-oli-gray">{Number(p.preco_anual) > 0 ? fmtBRL(Number(p.preco_anual)) : '—'}</td>
                    <td className="px-4 py-3 text-oli-gray">{fmtBRL(Number(p.taxa_min))}/min</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MÓDULOS ── */}
      {tab === 'modulos' && (
        <div className="space-y-3">
          <p className="text-[12px] text-oli-lgray">
            {modules.length} módulos no catálogo. Edição completa em <Link href="/modulos" className="text-oli-green font-semibold">/modulos</Link>.
          </p>
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Módulo', 'Categoria', 'Tipo', 'Valor', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {modules.map(m => (
                  <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-oli-dark">{m.nome}</p>
                      {m.descricao && <p className="text-[11px] text-oli-lgray mt-0.5 line-clamp-1">{m.descricao}</p>}
                    </td>
                    <td className="px-4 py-3 text-oli-gray text-[12px]">
                      {CATEGORIA_LABEL[m.categoria] ?? m.categoria}
                    </td>
                    <td className="px-4 py-3 text-[10px]">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold uppercase">
                        {m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-oli-dark">
                      {Number(m.valor) > 0 ? fmtBRL(Number(m.valor)) : 'Incluso no plano'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {m.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HORAS ── */}
      {tab === 'horas' && (
        <div className="space-y-3">
          <p className="text-[12px] text-oli-lgray">
            {hours.length} pacotes ofertados. Vendas via app/admin/Asaas. Saldos por médico em <Link href="/horas" className="text-oli-green font-semibold">/horas</Link>.
          </p>
          <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oli-border">
                  {['Pacote', 'Horas', 'Valor', 'R$/h', 'Validade', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-oli-border">
                {hours.map(p => {
                  const horas = Number(p.horas);
                  const valor = Number(p.valor);
                  const rate = horas > 0 ? valor / horas : 0;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-oli-dark">{p.nome}</td>
                      <td className="px-4 py-3 text-oli-gray">{horas}h</td>
                      <td className="px-4 py-3 font-semibold text-oli-dark">{fmtBRL(valor)}</td>
                      <td className="px-4 py-3 text-oli-gray">{fmtBRL(rate)}</td>
                      <td className="px-4 py-3 text-oli-gray text-[12px]">{p.validade_dias} dias</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                        }`}>
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer help */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-[12px] text-blue-900">
        <ExternalLink size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Edição completa</p>
          <p>Esta tela é resumo. Para criar/editar/desativar itens use as páginas dedicadas (/planos, /modulos, /horas).</p>
        </div>
      </div>

    </div>
  );
}
