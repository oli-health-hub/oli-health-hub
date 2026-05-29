'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Clock, User, MapPin, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReservationBlockProps {
  id:             string;
  professionalId: string;
  professionalName: string | null;
  plan:           string | null;
  roomName:       string;
  startTime:      string;  // ISO
  endTime:        string;  // ISO
  status:         string;
  statusLabel:    string;
  arrivedAt:      string | null;
  consultationStartedAt: string | null;
  consultationEndedAt:   string | null;
  // Style
  left:    string;
  width:   string;
  inSess:  boolean;
  done:    boolean;
  occClass: string;
  borderClass: string;
  textClass:   string;
}

const SP = 'America/Sao_Paulo';

function toSPDate(iso: string) {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: SP }));
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtFullDate(iso: string) {
  return toSPDate(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_COLOR: Record<string, string> = {
  agendado:       'bg-blue-50 text-blue-700 border-blue-200',
  em_uso:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  em_atendimento: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  concluido:      'bg-stone-100 text-stone-600 border-stone-200',
  completed:      'bg-stone-100 text-stone-600 border-stone-200',
  atendido:       'bg-stone-100 text-stone-600 border-stone-200',
  cancelled:      'bg-red-50 text-red-700 border-red-200',
  cancelado:      'bg-red-50 text-red-700 border-red-200',
  no_show:        'bg-orange-50 text-orange-700 border-orange-200',
  nao_compareceu: 'bg-orange-50 text-orange-700 border-orange-200',
};

const PLAN_COLOR: Record<string, string> = {
  START: 'bg-stone-100 text-stone-700',
  BASE:  'bg-emerald-50 text-emerald-700',
  PRO:   'bg-amber-50 text-amber-700',
  VIP:   'bg-violet-50 text-violet-700',
};

export function ReservationBlock(props: ReservationBlockProps) {
  const [open, setOpen] = useState(false);

  const rStart = toSPDate(props.startTime);
  const rEnd   = toSPDate(props.endTime);
  const durMin = Math.round((rEnd.getTime() - rStart.getTime()) / 60000);
  const durLabel = durMin < 60
    ? `${durMin}min`
    : `${Math.floor(durMin / 60)}h${durMin % 60 > 0 ? ` ${durMin % 60}min` : ''}`;

  const statusCls = STATUS_COLOR[props.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const planCls   = PLAN_COLOR[props.plan ?? ''] ?? 'bg-gray-100 text-gray-600';

  const blockClass = `absolute top-1 bottom-1 rounded-md border px-1.5 flex items-center overflow-hidden cursor-pointer hover:opacity-90 hover:shadow-sm transition-all z-10 ${
    props.inSess
      ? 'bg-green-200 border-green-400'
      : props.done
      ? 'bg-gray-200 border-gray-300'
      : `${props.occClass} ${props.borderClass}`
  }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${props.professionalName ?? '?'} | ${fmtTime(rStart)}–${fmtTime(rEnd)} | ${props.statusLabel}`}
        className={blockClass}
        style={{ left: props.left, width: props.width, minWidth: 4 }}
      >
        <span className={`text-[10px] font-bold truncate ${props.done ? 'text-gray-600' : props.textClass}`}>
          {props.professionalName?.split(' ')[0] ?? '?'}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-oli-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-oli-border flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">Reserva</p>
                <h3 className="text-base font-extrabold text-oli-dark truncate">
                  {props.professionalName ?? '—'}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCls}`}>
                    {props.statusLabel}
                  </span>
                  {props.plan && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${planCls}`}>
                      {props.plan}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-oli-lgray hover:text-oli-dark transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <Field icon={<Clock size={14} />} label="Horário">
                {fmtTime(rStart)} – {fmtTime(rEnd)}
                <span className="text-oli-lgray ml-2">({durLabel})</span>
              </Field>

              <Field icon={<MapPin size={14} />} label="Sala">
                {props.roomName}
              </Field>

              <Field icon={<Activity size={14} />} label="Status">
                {props.statusLabel}
              </Field>

              {props.arrivedAt && (
                <Field icon={<CheckCircle2 size={14} />} label="Check-in">
                  {fmtFullDate(props.arrivedAt)}
                </Field>
              )}

              {props.consultationStartedAt && (
                <Field icon={<Activity size={14} />} label="Início da consulta">
                  {fmtFullDate(props.consultationStartedAt)}
                </Field>
              )}

              {props.consultationEndedAt && (
                <Field icon={<CheckCircle2 size={14} />} label="Fim da consulta">
                  {fmtFullDate(props.consultationEndedAt)}
                </Field>
              )}

              {!props.arrivedAt && !props.consultationStartedAt && (
                <div className="flex items-center gap-2 text-[12px] text-oli-lgray bg-stone-50 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} />
                  Paciente ainda não fez check-in
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-oli-border bg-oli-bg flex items-center justify-between gap-3">
              <span className="text-[10px] text-oli-lgray truncate" title={props.id}>
                ID: {props.id.slice(0, 8)}…
              </span>
              <Link
                href={`/medicos/${props.professionalId}`}
                className="flex items-center gap-1.5 text-[12px] font-bold text-oli-green hover:text-oli-green/80 transition-colors"
              >
                <User size={14} />
                Ver perfil do médico
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  icon, label, children,
}: {
  icon:     React.ReactNode;
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-oli-lgray mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-oli-lgray uppercase tracking-wider">{label}</p>
        <div className="text-[13px] text-oli-dark font-medium mt-0.5">{children}</div>
      </div>
    </div>
  );
}
