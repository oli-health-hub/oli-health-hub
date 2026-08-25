'use client';

import { useState, useTransition } from 'react';
import { linkPatientToReservation, generatePatientCharge, triggerPatientMessage } from '@/app/actions';

interface Props {
  reservationId:    string;
  professionalId:   string;
  patients:         { id: string; nome: string }[];
  currentPatientId: string | null;
  currentPatientNome: string | null;
  currentValor:     number | null;
  chargeStatus:     string | null;
  asaasApproved:    boolean;
}

const CHARGE_STATUS_LABEL: Record<string, string> = {
  pendente: 'Cobrança pendente', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado',
};
const CHARGE_STATUS_BG: Record<string, string> = {
  pendente: 'bg-yellow-50 text-yellow-700', pago: 'bg-green-50 text-oli-green',
  vencido: 'bg-red-50 text-oli-red', cancelado: 'bg-gray-100 text-gray-500',
};

export function ReservaBillingActions(props: Props) {
  const [pending, startTransition] = useTransition();
  const [patientId, setPatientId] = useState('');
  const [valor, setValor] = useState('');
  const [cpf, setCpf] = useState('');
  const [billingType, setBillingType] = useState('PIX');

  function run(action: (fd: FormData) => Promise<void>, fd: FormData) {
    startTransition(async () => {
      try {
        await action(fd);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro na operação.');
      }
    });
  }

  function vincularPaciente() {
    const fd = new FormData();
    fd.set('reservation_id', props.reservationId);
    fd.set('professional_id', props.professionalId);
    fd.set('patient_id', patientId);
    fd.set('valor_consulta', valor);
    run(linkPatientToReservation, fd);
  }

  function enviarMensagem(triggerType: 'confirmacao_consulta' | 'lembrete_vespera') {
    const fd = new FormData();
    fd.set('reservation_id', props.reservationId);
    fd.set('professional_id', props.professionalId);
    fd.set('trigger_type', triggerType);
    run(triggerPatientMessage, fd);
  }

  function gerarCobranca() {
    if (!cpf.trim()) { alert('Informe o CPF do paciente.'); return; }
    const fd = new FormData();
    fd.set('reservation_id', props.reservationId);
    fd.set('professional_id', props.professionalId);
    fd.set('cpf_paciente', cpf);
    fd.set('billing_type', billingType);
    run(generatePatientCharge, fd);
  }

  if (!props.currentPatientId) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          className="text-xs border border-oli-border rounded-lg px-2 py-1.5 text-oli-dark bg-white focus:outline-none focus:ring-1 focus:ring-oli-green"
        >
          <option value="">Vincular paciente…</option>
          {props.patients.map(pt => <option key={pt.id} value={pt.id}>{pt.nome}</option>)}
        </select>
        <input
          type="number" step="0.01" min="0" placeholder="Valor R$"
          value={valor} onChange={e => setValor(e.target.value)}
          className="text-xs border border-oli-border rounded-lg px-2 py-1.5 w-24 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
        />
        <button
          onClick={vincularPaciente}
          disabled={pending || !patientId || !valor}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-oli-green text-white hover:bg-oli-green/80 transition-colors disabled:opacity-40"
        >
          Vincular
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-oli-dark">{props.currentPatientNome}</span>
        {props.currentValor && <span className="text-oli-lgray">R$ {props.currentValor.toFixed(2).replace('.', ',')}</span>}
        {props.chargeStatus && (
          <span className={`font-bold px-2 py-0.5 rounded-full ${CHARGE_STATUS_BG[props.chargeStatus] ?? 'bg-gray-100'}`}>
            {CHARGE_STATUS_LABEL[props.chargeStatus] ?? props.chargeStatus}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => enviarMensagem('confirmacao_consulta')}
          disabled={pending}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40"
        >
          Enviar confirmação
        </button>
        <button
          onClick={() => enviarMensagem('lembrete_vespera')}
          disabled={pending}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40"
        >
          Enviar lembrete
        </button>
      </div>

      {!props.chargeStatus && (
        props.asaasApproved ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text" placeholder="CPF do paciente"
              value={cpf} onChange={e => setCpf(e.target.value)}
              className="text-xs border border-oli-border rounded-lg px-2 py-1.5 w-32 text-oli-dark focus:outline-none focus:ring-1 focus:ring-oli-green"
            />
            <select
              value={billingType} onChange={e => setBillingType(e.target.value)}
              className="text-xs border border-oli-border rounded-lg px-2 py-1.5 text-oli-dark bg-white focus:outline-none focus:ring-1 focus:ring-oli-green"
            >
              <option value="PIX">PIX</option>
              <option value="BOLETO_BANCARIO">Boleto</option>
              <option value="CREDIT_CARD">Cartão</option>
            </select>
            <button
              onClick={gerarCobranca}
              disabled={pending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-oli-gold text-white hover:bg-oli-gold/80 transition-colors disabled:opacity-40"
            >
              Gerar cobrança
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-oli-lgray">Aguardando aprovação da subconta Asaas para cobrar.</p>
        )
      )}
    </div>
  );
}
