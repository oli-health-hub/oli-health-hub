import { createTeamProfile } from '@/app/actions';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NovoPerfilEquipePage() {
  return (
    <div className="p-7 max-w-2xl">
      <Link href="/equipe" className="inline-flex items-center gap-1.5 text-sm text-oli-gray hover:text-oli-dark mb-4">
        <ArrowLeft size={14} /> Voltar pra Equipe
      </Link>

      <h1 className="text-xl font-bold text-oli-dark mb-1">Novo perfil de equipe</h1>
      <p className="text-sm text-oli-gray mb-6">
        Founder, especialista ou parceiro — aparece na Comunidade do app, sem campos médicos.
        Não é um login real (sem e-mail de convite).
      </p>

      <form action={createTeamProfile} className="bg-white rounded-2xl border border-oli-border p-5 space-y-4">
        <FieldWrap label="Nome *">
          <input name="nome" required
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>

        <FieldWrap label="Tipo *">
          <select name="user_type" required defaultValue=""
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm">
            <option value="" disabled>Selecione…</option>
            <option value="founder">Founder</option>
            <option value="specialist">Especialista</option>
            <option value="partner">Parceiro</option>
          </select>
        </FieldWrap>

        <FieldWrap label="Título / Papel">
          <input name="especialidade" placeholder="Ex: Founder & CEO, Direito Médico"
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>

        <FieldWrap label="Bio">
          <textarea name="bio" rows={3}
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm resize-y" />
        </FieldWrap>

        <FieldWrap label="URL da foto (Storage)">
          <input name="foto_url" type="url" placeholder="https://..."
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FieldWrap label="Instagram">
            <input name="instagram" placeholder="@usuario"
              className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
          </FieldWrap>
          <FieldWrap label="LinkedIn">
            <input name="linkedin" placeholder="linkedin.com/in/..."
              className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
          </FieldWrap>
          <FieldWrap label="Website">
            <input name="website" type="url" placeholder="https://..."
              className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
          </FieldWrap>
        </div>

        <FieldWrap label="WhatsApp">
          <input name="whatsapp" placeholder="11999999999"
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>

        <button
          type="submit"
          className="text-sm font-bold bg-oli-green text-white px-4 py-2 rounded-lg hover:bg-oli-green/90 transition-colors"
        >
          Criar perfil
        </button>
      </form>
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
