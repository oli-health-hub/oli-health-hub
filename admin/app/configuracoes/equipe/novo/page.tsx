import Link from 'next/link';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui';
import { NewTeamProfileForm } from './NewTeamProfileForm';

export const dynamic = 'force-dynamic';

export default function NovoPerfilEquipePage() {
  return (
    <div className="p-7 max-w-2xl">
      <Link href="/configuracoes/equipe" className="inline-flex items-center gap-1.5 text-sm text-oli-gray hover:text-oli-dark mb-4">
        <ArrowLeft size={14} /> Voltar para a Equipe
      </Link>

      <div className="mb-6">
        <CabecalhoPagina
          titulo="Novo perfil de equipe"
          subtitulo="Founder, especialista, parceiro ou equipe OLI — aparece na Comunidade do app, sem campos médicos. Não é um login real (sem e-mail de convite)."
          icone={UserPlus}
        />
      </div>

      <NewTeamProfileForm />
    </div>
  );
}
