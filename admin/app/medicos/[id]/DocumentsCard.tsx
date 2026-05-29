'use client';

import { useState, useTransition } from 'react';
import { FileText, Upload, Trash2, ExternalLink, ChevronDown, AlertCircle } from 'lucide-react';
import { addProfessionalDocument, removeProfessionalDocument } from '@/app/actions';

interface DocRow {
  id:          string;
  type:        string;
  name:        string;
  url:         string;
  size_bytes:  number | null;
  expires_at:  string | null;
  uploaded_at: string;
}

interface Props {
  userId:    string;
  documents: DocRow[];
}

const DOC_TYPE_LABEL: Record<string, string> = {
  crm:                 'CRM',
  contrato:            'Contrato',
  rg:                  'RG',
  cpf:                 'CPF',
  comprovante_endereco: 'Comprovante de endereço',
  outro:               'Outro',
};

const DOC_TYPE_COLOR: Record<string, string> = {
  crm:                 'bg-blue-50 text-blue-700',
  contrato:            'bg-emerald-50 text-emerald-700',
  rg:                  'bg-amber-50 text-amber-700',
  cpf:                 'bg-amber-50 text-amber-700',
  comprovante_endereco: 'bg-violet-50 text-violet-700',
  outro:               'bg-stone-100 text-stone-700',
};

function fmtSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function isExpired(date: string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}

function isExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const days = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days > 0 && days <= 30;
}

export function DocumentsCard({ userId, documents }: Props) {
  const [open, setOpen] = useState(documents.length > 0);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();

  // Form state
  const [docType,    setDocType]    = useState('contrato');
  const [docName,    setDocName]    = useState('');
  const [docUrl,     setDocUrl]     = useState('');
  const [expiresAt,  setExpiresAt]  = useState('');

  const handleAdd = () => {
    if (!docName.trim() || !docUrl.trim()) {
      alert('Nome e URL são obrigatórios.');
      return;
    }
    const fd = new FormData();
    fd.append('user_id',    userId);
    fd.append('doc_type',   docType);
    fd.append('name',       docName.trim());
    fd.append('url',        docUrl.trim());
    if (expiresAt) fd.append('expires_at', expiresAt);

    startTransition(async () => {
      try {
        await addProfessionalDocument(fd);
        setDocName(''); setDocUrl(''); setExpiresAt(''); setDocType('contrato');
        setShowForm(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  };

  const handleRemove = (id: string, name: string) => {
    if (!confirm(`Remover documento "${name}"?`)) return;
    const fd = new FormData();
    fd.append('id',      id);
    fd.append('user_id', userId);
    startTransition(async () => {
      try {
        await removeProfessionalDocument(fd);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
            <FileText size={16} className="text-orange-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-oli-dark">Documentos</p>
            <p className="text-[11px] text-oli-lgray">
              {documents.length} documento{documents.length !== 1 ? 's' : ''} no prontuário
            </p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-oli-lgray transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-oli-border">
          {/* Lista de docs */}
          {documents.length === 0 ? (
            <div className="px-5 py-6 text-center text-oli-lgray text-sm">
              Nenhum documento cadastrado
            </div>
          ) : (
            <div className="divide-y divide-oli-border">
              {documents.map(d => {
                const expired = isExpired(d.expires_at);
                const expiring = isExpiringSoon(d.expires_at);
                return (
                  <div key={d.id} className="px-5 py-3 flex items-center gap-3 hover:bg-stone-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${DOC_TYPE_COLOR[d.type] ?? DOC_TYPE_COLOR.outro}`}>
                          {DOC_TYPE_LABEL[d.type] ?? d.type}
                        </span>
                        <p className="font-semibold text-oli-dark text-[13px] truncate">{d.name}</p>
                        {expired && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                            <AlertCircle size={10} /> Vencido
                          </span>
                        )}
                        {expiring && !expired && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                            <AlertCircle size={10} /> Vence em breve
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-oli-lgray mt-0.5">
                        Adicionado em {fmtDate(d.uploaded_at)} · {fmtSize(d.size_bytes)}
                        {d.expires_at && ` · Vence ${fmtDate(d.expires_at)}`}
                      </p>
                    </div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-oli-green hover:text-oli-green/80 flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink size={12} /> Abrir
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemove(d.id, d.name)}
                      disabled={pending}
                      className="text-oli-lgray hover:text-red-600 transition-colors p-1"
                      aria-label="Remover documento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form add */}
          <div className="px-5 py-3 bg-stone-50/50 border-t border-oli-border">
            {showForm ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider block mb-1">Tipo</span>
                    <select
                      value={docType}
                      onChange={e => setDocType(e.target.value)}
                      className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm"
                    >
                      {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider block mb-1">Vencimento (opcional)</span>
                    <input
                      type="date"
                      value={expiresAt}
                      onChange={e => setExpiresAt(e.target.value)}
                      className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider block mb-1">Nome do arquivo</span>
                  <input
                    value={docName}
                    onChange={e => setDocName(e.target.value)}
                    placeholder="Ex: Contrato assinado 2026"
                    className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider block mb-1">URL do documento</span>
                  <input
                    type="url"
                    value={docUrl}
                    onChange={e => setDocUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <span className="text-[11px] text-oli-lgray mt-1 block">
                    Faça upload no Supabase Storage (bucket professional-docs) ou Google Drive, cole o link aqui.
                  </span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={pending}
                    className="flex items-center gap-1.5 text-xs font-bold bg-oli-green text-white px-4 py-2 rounded-lg hover:bg-oli-green/90 disabled:opacity-50"
                  >
                    <Upload size={14} /> Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    disabled={pending}
                    className="text-xs font-semibold px-4 py-2 rounded-lg hover:bg-stone-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-oli-green hover:text-oli-green/80"
              >
                <Upload size={14} /> Adicionar documento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
