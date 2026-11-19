'use client';

import { useState, useTransition } from 'react';
import { Check, Save } from 'lucide-react';
import { updateTeamProfileFields } from '@/app/actions';

interface Props {
  userId: string;
  nome: string;
  userType: string;
  especialidade: string | null;
  bio: string | null;
  fotoUrl: string | null;
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  whatsapp: string | null;
  adminNotes: string | null;
}

export function TeamProfileForm(props: Props) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [nome, setNome] = useState(props.nome);
  const [userType, setUserType] = useState(props.userType);
  const [especialidade, setEspecialidade] = useState(props.especialidade ?? '');
  const [bio, setBio] = useState(props.bio ?? '');
  const [fotoUrl, setFotoUrl] = useState(props.fotoUrl ?? '');
  const [instagram, setInstagram] = useState(props.instagram ?? '');
  const [linkedin, setLinkedin] = useState(props.linkedin ?? '');
  const [website, setWebsite] = useState(props.website ?? '');
  const [whatsapp, setWhatsapp] = useState(props.whatsapp ?? '');
  const [adminNotes, setAdminNotes] = useState(props.adminNotes ?? '');

  const submit = () => {
    setError('');
    setSaved(false);
    const fd = new FormData();
    fd.append('user_id', props.userId);
    fd.append('nome', nome);
    fd.append('user_type', userType);
    fd.append('especialidade', especialidade);
    fd.append('bio', bio);
    fd.append('foto_url', fotoUrl);
    fd.append('instagram', instagram);
    fd.append('linkedin', linkedin);
    fd.append('website', website);
    fd.append('whatsapp', whatsapp);
    fd.append('admin_notes', adminNotes);

    startTransition(async () => {
      try {
        await updateTeamProfileFields(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar.');
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-oli-border p-5 space-y-4">
      <FieldWrap label="Nome">
        <input value={nome} onChange={e => setNome(e.target.value)}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </FieldWrap>

      <FieldWrap label="Tipo">
        <select value={userType} onChange={e => setUserType(e.target.value)}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm">
          <option value="founder">Founder</option>
          <option value="specialist">Especialista</option>
          <option value="partner">Parceiro</option>
          <option value="team">Equipe OLI</option>
        </select>
      </FieldWrap>

      <FieldWrap label="Título / Papel">
        <input value={especialidade} onChange={e => setEspecialidade(e.target.value)}
          placeholder="Ex: Founder & CEO, Direito Médico"
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </FieldWrap>

      <FieldWrap label="Bio">
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm resize-y" />
      </FieldWrap>

      <FieldWrap label="URL da foto (Storage)">
        <input value={fotoUrl} onChange={e => setFotoUrl(e.target.value)} type="url" placeholder="https://..."
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </FieldWrap>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FieldWrap label="Instagram">
          <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@usuario"
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>
        <FieldWrap label="LinkedIn">
          <input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/..."
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>
        <FieldWrap label="Website">
          <input value={website} onChange={e => setWebsite(e.target.value)} type="url" placeholder="https://..."
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>
      </div>

      <FieldWrap label="WhatsApp">
        <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="11999999999"
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </FieldWrap>

      <FieldWrap label="Notas internas do admin">
        <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm resize-y" />
      </FieldWrap>

      {error && (
        <p className="text-sm text-oli-red bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex items-center gap-1.5 text-sm font-bold bg-oli-green text-white px-4 py-2 rounded-lg hover:bg-oli-green/90 transition-colors disabled:opacity-50"
        >
          <Save size={14} /> {pending ? 'Salvando…' : 'Salvar alterações'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
            <Check size={16} /> Salvo
          </span>
        )}
      </div>
    </div>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
