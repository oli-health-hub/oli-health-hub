'use client';

import { useState, useTransition } from 'react';
import {
  Shield, ShieldOff, PauseCircle, PlayCircle, Trash2, Users, UserX,
  Calendar, FileText, AlertTriangle, X, ChevronDown, Save,
} from 'lucide-react';
import {
  changeAccountStatus, toggleComunidadeAccess, updateContract,
  softDeleteUser, updateProfileFields,
} from '@/app/actions';

interface Props {
  userId:             string;
  nome:               string;
  email:              string;
  accountStatus:      'active' | 'paused' | 'suspended' | 'banned' | 'deleted';
  statusReason:       string | null;
  comunidadeBanned:   boolean;
  comunidadeBanReason: string | null;
  contractStartDate:  string | null;
  contractEndDate:    string | null;
  contractDocUrl:     string | null;
  adminNotes:         string | null;
  crm:                string | null;
  especialidade:      string | null;
  tratamento:         string | null;
  cidadeUf:           string | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; description: string }> = {
  active:    { label: 'Ativa',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', description: 'Médico acessa o app e o ecossistema normalmente.' },
  paused:    { label: 'Pausada',   color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     description: 'Pausa temporária. Sem cobrança recorrente. Médico vê tela de bloqueio ao abrir app.' },
  suspended: { label: 'Suspensa',  color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',   description: 'Suspensa por inadimplência ou problema operacional. Médico bloqueado até regularizar.' },
  banned:    { label: 'Banida',    color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         description: 'Banido por violação. Não tem mais acesso ao app, ecossistema ou comunidade.' },
  deleted:   { label: 'Excluída',  color: 'text-stone-700',   bg: 'bg-stone-100 border-stone-300',   description: 'Conta excluída. Dados históricos preservados (LGPD/auditoria).' },
};

export function MedicoManagementCard(props: Props) {
  const [pending, startTransition] = useTransition();
  const [openConfirm, setOpenConfirm] = useState<null | 'pause' | 'suspend' | 'ban' | 'delete' | 'activate'>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [openComunidade, setOpenComunidade] = useState(false);
  const [openContract, setOpenContract] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  const statusMeta = STATUS_META[props.accountStatus] ?? STATUS_META.active;

  const handleStatusChange = (newStatus: 'active' | 'paused' | 'suspended' | 'banned', reason: string) => {
    const fd = new FormData();
    fd.append('user_id', props.userId);
    fd.append('status', newStatus);
    if (reason) fd.append('reason', reason);
    startTransition(async () => {
      try {
        await changeAccountStatus(fd);
        setOpenConfirm(null);
        setReasonInput('');
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao alterar status.');
      }
    });
  };

  const handleDelete = (reason: string) => {
    const fd = new FormData();
    fd.append('user_id', props.userId);
    if (reason) fd.append('reason', reason);
    startTransition(async () => {
      try {
        await softDeleteUser(fd);
        setOpenConfirm(null);
        setReasonInput('');
        window.location.href = '/medicos';
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao excluir.');
      }
    });
  };

  return (
    <div className="space-y-4">

      {/* ── Card de status principal ── */}
      <div className={`rounded-2xl border-2 p-5 ${statusMeta.bg}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Status da conta</p>
            <div className="flex items-center gap-2 mt-1">
              <h2 className={`text-2xl font-extrabold ${statusMeta.color}`}>{statusMeta.label}</h2>
              {props.comunidadeBanned && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  Comunidade bloqueada
                </span>
              )}
            </div>
            <p className="text-[13px] text-oli-dark/80 mt-2 leading-relaxed">{statusMeta.description}</p>
            {props.statusReason && (
              <p className="text-[12px] text-oli-dark/70 mt-2 italic">
                <strong>Motivo:</strong> {props.statusReason}
              </p>
            )}
          </div>
        </div>

        {/* Ações de status */}
        <div className="flex flex-wrap gap-2 mt-5">
          {props.accountStatus !== 'active' && props.accountStatus !== 'deleted' && (
            <ActionBtn
              icon={<PlayCircle size={14} />}
              label="Reativar"
              variant="primary"
              onClick={() => handleStatusChange('active', '')}
              disabled={pending}
            />
          )}
          {props.accountStatus === 'active' && (
            <>
              <ActionBtn
                icon={<PauseCircle size={14} />}
                label="Pausar"
                variant="amber"
                onClick={() => setOpenConfirm('pause')}
                disabled={pending}
              />
              <ActionBtn
                icon={<Shield size={14} />}
                label="Suspender"
                variant="orange"
                onClick={() => setOpenConfirm('suspend')}
                disabled={pending}
              />
              <ActionBtn
                icon={<ShieldOff size={14} />}
                label="Banir"
                variant="danger"
                onClick={() => setOpenConfirm('ban')}
                disabled={pending}
              />
            </>
          )}
          {props.accountStatus !== 'deleted' && (
            <ActionBtn
              icon={<Trash2 size={14} />}
              label="Excluir conta"
              variant="destructive"
              onClick={() => setOpenConfirm('delete')}
              disabled={pending}
            />
          )}
        </div>
      </div>

      {/* ── Card Comunidade ── */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenComunidade(!openComunidade)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              props.comunidadeBanned ? 'bg-red-50' : 'bg-emerald-50'
            }`}>
              {props.comunidadeBanned
                ? <UserX size={16} className="text-red-600" />
                : <Users size={16} className="text-emerald-600" />}
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-oli-dark">Comunidade OLI</p>
              <p className="text-[11px] text-oli-lgray">
                {props.comunidadeBanned ? 'Bloqueado' : 'Acesso liberado'}
                {props.comunidadeBanReason && ` · ${props.comunidadeBanReason}`}
              </p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-oli-lgray transition-transform ${openComunidade ? 'rotate-180' : ''}`} />
        </button>
        {openComunidade && (
          <ComunidadeForm
            userId={props.userId}
            banned={props.comunidadeBanned}
            reason={props.comunidadeBanReason}
          />
        )}
      </div>

      {/* ── Card Contrato ── */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenContract(!openContract)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Calendar size={16} className="text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-oli-dark">Contrato</p>
              <p className="text-[11px] text-oli-lgray">
                {props.contractStartDate
                  ? `${fmtDate(props.contractStartDate)} → ${props.contractEndDate ? fmtDate(props.contractEndDate) : 'sem fim'}`
                  : 'Sem dados de contrato'}
              </p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-oli-lgray transition-transform ${openContract ? 'rotate-180' : ''}`} />
        </button>
        {openContract && (
          <ContractForm
            userId={props.userId}
            startDate={props.contractStartDate}
            endDate={props.contractEndDate}
            docUrl={props.contractDocUrl}
          />
        )}
      </div>

      {/* ── Card Editar Perfil ── */}
      <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenProfile(!openProfile)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <FileText size={16} className="text-violet-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-oli-dark">Editar cadastro</p>
              <p className="text-[11px] text-oli-lgray">Nome, CRM, especialidade, notas internas</p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-oli-lgray transition-transform ${openProfile ? 'rotate-180' : ''}`} />
        </button>
        {openProfile && (
          <ProfileForm
            userId={props.userId}
            nome={props.nome}
            crm={props.crm}
            especialidade={props.especialidade}
            tratamento={props.tratamento}
            cidadeUf={props.cidadeUf}
            adminNotes={props.adminNotes}
          />
        )}
      </div>

      {/* ── Modal de confirmação ── */}
      {openConfirm && (
        <ConfirmModal
          type={openConfirm}
          nome={props.nome}
          reason={reasonInput}
          onReasonChange={setReasonInput}
          onCancel={() => { setOpenConfirm(null); setReasonInput(''); }}
          onConfirm={() => {
            if (openConfirm === 'pause')      handleStatusChange('paused',    reasonInput);
            else if (openConfirm === 'suspend') handleStatusChange('suspended', reasonInput);
            else if (openConfirm === 'ban')     handleStatusChange('banned',    reasonInput);
            else if (openConfirm === 'delete')  handleDelete(reasonInput);
          }}
          pending={pending}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBtn({
  icon, label, variant, onClick, disabled,
}: {
  icon:     React.ReactNode;
  label:    string;
  variant:  'primary' | 'amber' | 'orange' | 'danger' | 'destructive';
  onClick:  () => void;
  disabled: boolean;
}) {
  const cls: Record<string, string> = {
    primary:    'bg-oli-green text-white hover:bg-oli-green/90',
    amber:      'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300',
    orange:     'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-300',
    danger:     'bg-red-100 text-red-800 hover:bg-red-200 border border-red-300',
    destructive: 'bg-stone-100 text-stone-800 hover:bg-stone-200 border border-stone-300 ml-auto',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${cls[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ComunidadeForm({ userId, banned, reason }: { userId: string; banned: boolean; reason: string | null }) {
  const [pending, startTransition] = useTransition();
  const [r, setR] = useState(reason ?? '');

  const submit = (newBanned: boolean) => {
    const fd = new FormData();
    fd.append('user_id', userId);
    fd.append('banned',  String(newBanned));
    if (newBanned && r) fd.append('reason', r);
    startTransition(async () => {
      try {
        await toggleComunidadeAccess(fd);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  };

  return (
    <div className="px-5 py-4 border-t border-oli-border bg-stone-50/50 space-y-3">
      {banned ? (
        <>
          <p className="text-[12px] text-oli-gray">
            Médico não vê a aba Comunidade no app. Clique para reativar acesso.
          </p>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            <Users size={14} /> Liberar acesso à comunidade
          </button>
        </>
      ) : (
        <>
          <label className="block text-[11px] font-bold text-oli-lgray uppercase tracking-wider">
            Motivo do bloqueio (opcional)
          </label>
          <input
            type="text"
            value={r}
            onChange={e => setR(e.target.value)}
            placeholder="Ex: comentário ofensivo em 2026-05-28"
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <UserX size={14} /> Bloquear da comunidade
          </button>
        </>
      )}
    </div>
  );
}

function ContractForm({
  userId, startDate, endDate, docUrl,
}: {
  userId: string; startDate: string | null; endDate: string | null; docUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState(startDate ?? '');
  const [end,   setEnd]   = useState(endDate ?? '');
  const [url,   setUrl]   = useState(docUrl ?? '');

  const submit = () => {
    const fd = new FormData();
    fd.append('user_id',          userId);
    fd.append('start_date',       start);
    fd.append('end_date',         end);
    fd.append('contract_doc_url', url);
    startTransition(async () => {
      try {
        await updateContract(fd);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  };

  return (
    <div className="px-5 py-4 border-t border-oli-border bg-stone-50/50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Início">
          <input type="date" value={start} onChange={e => setStart(e.target.value)}
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Término">
          <input type="date" value={end} onChange={e => setEnd(e.target.value)}
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </Field>
      </div>
      <Field label="URL do contrato assinado (Storage / Drive)">
        <input type="url" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </Field>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="flex items-center gap-1.5 text-xs font-bold bg-oli-green text-white px-3 py-2 rounded-lg hover:bg-oli-green/90 disabled:opacity-50"
      >
        <Save size={14} /> Salvar contrato
      </button>
    </div>
  );
}

function ProfileForm({
  userId, nome, crm, especialidade, tratamento, cidadeUf, adminNotes,
}: {
  userId: string; nome: string;
  crm: string | null; especialidade: string | null;
  tratamento: string | null; cidadeUf: string | null;
  adminNotes: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [n,   setN]   = useState(nome);
  const [c,   setC]   = useState(crm ?? '');
  const [e,   setE]   = useState(especialidade ?? '');
  const [t,   setT]   = useState(tratamento ?? '');
  const [ci,  setCi]  = useState(cidadeUf ?? '');
  const [no,  setNo]  = useState(adminNotes ?? '');

  const submit = () => {
    const fd = new FormData();
    fd.append('user_id',      userId);
    fd.append('nome',         n);
    fd.append('crm',          c);
    fd.append('especialidade', e);
    fd.append('tratamento',   t);
    fd.append('cidade_uf',    ci);
    fd.append('admin_notes',  no);
    startTransition(async () => {
      try {
        await updateProfileFields(fd);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  };

  return (
    <div className="px-5 py-4 border-t border-oli-border bg-stone-50/50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tratamento">
          <select value={t} onChange={e => setT(e.target.value)}
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm">
            <option value="">—</option>
            <option value="Dr.">Dr.</option>
            <option value="Dra.">Dra.</option>
          </select>
        </Field>
        <Field label="CRM">
          <input value={c} onChange={e => setC(e.target.value)}
            placeholder="CRM/SP 12345"
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </Field>
      </div>
      <Field label="Nome">
        <input value={n} onChange={e => setN(e.target.value)}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </Field>
      <Field label="Especialidade">
        <input value={e} onChange={e => setE(e.target.value)}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </Field>
      <Field label="Cidade/UF">
        <input value={ci} onChange={e => setCi(e.target.value)}
          placeholder="São Paulo/SP"
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </Field>
      <Field label="Notas internas do admin (não visível ao médico)">
        <textarea value={no} onChange={e => setNo(e.target.value)}
          rows={3}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm resize-y" />
      </Field>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="flex items-center gap-1.5 text-xs font-bold bg-oli-green text-white px-3 py-2 rounded-lg hover:bg-oli-green/90 disabled:opacity-50"
      >
        <Save size={14} /> Salvar alterações
      </button>
    </div>
  );
}

function ConfirmModal({
  type, nome, reason, onReasonChange, onCancel, onConfirm, pending,
}: {
  type:           'pause' | 'suspend' | 'ban' | 'delete' | 'activate';
  nome:           string;
  reason:         string;
  onReasonChange: (v: string) => void;
  onCancel:       () => void;
  onConfirm:      () => void;
  pending:        boolean;
}) {
  const meta: Record<string, { title: string; description: string; cta: string; danger: boolean }> = {
    pause:    { title: 'Pausar conta',   description: 'Médico não acessará o app até reativação. Sem cobrança recorrente nesse período.', cta: 'Pausar',  danger: false },
    suspend:  { title: 'Suspender conta', description: 'Médico bloqueado por inadimplência ou problema operacional. Pode reativar depois.', cta: 'Suspender', danger: true },
    ban:      { title: 'Banir conta',    description: 'Bloqueio severo por violação de regras. Use apenas em casos graves.', cta: 'Banir', danger: true },
    delete:   { title: 'Excluir conta',  description: 'Médico perde acesso permanente. Histórico de reservas e cobranças preservado.', cta: 'Excluir definitivamente', danger: true },
    activate: { title: 'Reativar',       description: 'Médico volta a acessar normalmente.', cta: 'Reativar', danger: false },
  };
  const m = meta[type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-oli-border flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              m.danger ? 'bg-red-50' : 'bg-amber-50'
            }`}>
              <AlertTriangle size={20} className={m.danger ? 'text-red-600' : 'text-amber-600'} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-oli-dark">{m.title}</h3>
              <p className="text-[12px] text-oli-lgray mt-0.5">{nome}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="text-oli-lgray hover:text-oli-dark">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-oli-gray leading-relaxed">{m.description}</p>
          <Field label="Motivo (opcional)">
            <textarea
              value={reason}
              onChange={e => onReasonChange(e.target.value)}
              placeholder="Ex: férias até 30/06"
              rows={3}
              className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm resize-y"
            />
          </Field>
        </div>
        <div className="px-5 py-3 border-t border-oli-border bg-oli-bg flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="text-sm font-semibold px-4 py-2 rounded-lg hover:bg-stone-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`text-sm font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
              m.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-oli-green hover:bg-oli-green/90'
            }`}
          >
            {pending ? 'Processando…' : m.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}
