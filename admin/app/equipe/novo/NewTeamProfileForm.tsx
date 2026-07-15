'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTeamProfile } from '@/app/actions';

export function NewTeamProfileForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [nome, setNome] = useState('');
  const [userType, setUserType] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [bio, setBio] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const submit = () => {
    setError('');
    if (!nome.trim()) { setError('Nome é obrigatório.'); return; }
    if (!userType) { setError('Selecione um tipo.'); return; }

    const fd = new FormData();
    fd.append('nome', nome);
    fd.append('user_type', userType);
    fd.append('especialidade', especialidade);
    fd.append('bio', bio);
    fd.append('foto_url', fotoUrl);
    fd.append('instagram', instagram);
    fd.append('linkedin', linkedin);
    fd.append('website', website);
    fd.append('whatsapp', whatsapp);

    startTransition(async () => {
      try {
        await createTeamProfile(fd);
        router.push('/equipe');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao criar perfil.');
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-oli-border p-5 space-y-4">
      <FieldWrap label="Nome *">
        <input value={nome} onChange={e => setNome(e.target.value)}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
      </FieldWrap>

      <FieldWrap label="Tipo *">
        <select value={userType} onChange={e => setUserType(e.target.value)}
          className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm">
          <option value="">Selecione…</option>
          <option value="founder">Founder</option>
          <option value="specialist">Especialista</option>
          <option value="partner">Parceiro</option>
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

      {error && (
        <p className="text-sm text-oli-red bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="text-sm font-bold bg-oli-green text-white px-4 py-2 rounded-lg hover:bg-oli-green/90 transition-colors disabled:opacity-50"
      >
        {pending ? 'Criando…' : 'Criar perfil'}
      </button>
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
