import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewTeamProfileForm } from './NewTeamProfileForm';

export const dynamic = 'force-dynamic';

export default function NovoPerfilEquipePage() {
  return (
    <div className="p-7 max-w-2xl">
      <Link href="/equipe" className="inline-flex items-center gap-1.5 text-sm text-oli-gray hover:text-oli-dark mb-4">
        <ArrowLeft size={14} /> Voltar pra Equipe
      </Link>

      <h1 className="text-xl font-bold text-oli-dark mb-1">Novo perfil de equipe</h1>
      <p className="text-sm text-oli-gray mb-6">
        Founder, especialista, parceiro ou equipe OLI — aparece na Comunidade do app, sem campos médicos.
        Não é um login real (sem e-mail de convite).
      </p>

      <NewTeamProfileForm />
    </div>
  );
}
