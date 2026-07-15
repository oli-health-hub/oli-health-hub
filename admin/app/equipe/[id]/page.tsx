import { createSupabaseServer } from '@/lib/supabase-server';
import { updateTeamProfileFields } from '@/app/actions';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DeleteTeamProfileButton } from './DeleteTeamProfileButton';

export const dynamic = 'force-dynamic';

const TEAM_TYPES = ['founder', 'specialist', 'partner'];

export default async function EquipeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServer();

  const { data: p } = await supabase
    .from('profiles')
    .select('id, nome, especialidade, bio, foto_url, instagram, linkedin, website, whatsapp, user_type, admin_notes, created_at')
    .eq('id', params.id)
    .single();

  if (!p || !TEAM_TYPES.includes(p.user_type)) return notFound();

  return (
    <div className="p-7 max-w-2xl">
      <Link href="/equipe" className="inline-flex items-center gap-1.5 text-sm text-oli-gray hover:text-oli-dark mb-4">
        <ArrowLeft size={14} /> Voltar pra Equipe
      </Link>

      <h1 className="text-xl font-bold text-oli-dark mb-1">{p.nome}</h1>
      <p className="text-sm text-oli-gray mb-6">
        Cadastrado em {new Date(p.created_at).toLocaleDateString('pt-BR')}
      </p>

      <form action={updateTeamProfileFields} className="bg-white rounded-2xl border border-oli-border p-5 space-y-4">
        <input type="hidden" name="user_id" value={p.id} />

        <FieldWrap label="Nome">
          <input name="nome" defaultValue={p.nome ?? ''}
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>

        <FieldWrap label="Tipo">
          <select name="user_type" defaultValue={p.user_type}
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm">
            <option value="founder">Founder</option>
            <option value="specialist">Especialista</option>
            <option value="partner">Parceiro</option>
          </select>
        </FieldWrap>

        <FieldWrap label="Título / Papel">
          <input name="especialidade" defaultValue={p.especialidade ?? ''}
            placeholder="Ex: Founder & CEO, Direito Médico"
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>

        <FieldWrap label="Bio">
          <textarea name="bio" defaultValue={p.bio ?? ''} rows={3}
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm resize-y" />
        </FieldWrap>

        <FieldWrap label="URL da foto (Storage)">
          <input name="foto_url" type="url" defaultValue={p.foto_url ?? ''} placeholder="https://..."
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FieldWrap label="Instagram">
            <input name="instagram" defaultValue={p.instagram ?? ''} placeholder="@usuario"
              className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
          </FieldWrap>
          <FieldWrap label="LinkedIn">
            <input name="linkedin" defaultValue={p.linkedin ?? ''} placeholder="linkedin.com/in/..."
              className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
          </FieldWrap>
          <FieldWrap label="Website">
            <input name="website" type="url" defaultValue={p.website ?? ''} placeholder="https://..."
              className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
          </FieldWrap>
        </div>

        <FieldWrap label="WhatsApp">
          <input name="whatsapp" defaultValue={p.whatsapp ?? ''} placeholder="11999999999"
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm" />
        </FieldWrap>

        <FieldWrap label="Notas internas do admin">
          <textarea name="admin_notes" defaultValue={p.admin_notes ?? ''} rows={3}
            className="w-full border border-oli-border rounded-lg px-3 py-2 text-sm resize-y" />
        </FieldWrap>

        <button
          type="submit"
          className="text-sm font-bold bg-oli-green text-white px-4 py-2 rounded-lg hover:bg-oli-green/90 transition-colors"
        >
          Salvar alterações
        </button>
      </form>

      <div className="bg-red-50 rounded-2xl border border-red-200 p-5 mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Zona de perigo</p>
        <p className="text-sm font-bold text-red-800 mb-1">Apagar permanentemente</p>
        <p className="text-[12px] text-red-700 mb-4 leading-relaxed">
          Remove o perfil inteiro do banco de dados. Irreversível.
        </p>
        <DeleteTeamProfileButton userId={p.id} nome={p.nome ?? ''} />
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
