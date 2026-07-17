import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DeleteTeamProfileButton } from './DeleteTeamProfileButton';
import { TeamProfileForm } from './TeamProfileForm';

export const dynamic = 'force-dynamic';

const TEAM_TYPES = ['founder', 'specialist', 'partner', 'team'];

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

      <TeamProfileForm
        userId={p.id}
        nome={p.nome ?? ''}
        userType={p.user_type}
        especialidade={p.especialidade}
        bio={p.bio}
        fotoUrl={p.foto_url}
        instagram={p.instagram}
        linkedin={p.linkedin}
        website={p.website}
        whatsapp={p.whatsapp}
        adminNotes={p.admin_notes}
      />

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
