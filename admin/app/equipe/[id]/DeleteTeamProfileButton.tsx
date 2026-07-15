'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { hardDeleteUser } from '@/app/actions';

export function DeleteTeamProfileButton({ userId, nome }: { userId: string; nome: string }) {
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm(`Apagar o perfil de "${nome}" permanentemente? Não há como desfazer.`)) return;
    startTransition(async () => {
      try {
        await hardDeleteUser((() => {
          const fd = new FormData();
          fd.append('user_id', userId);
          return fd;
        })());
        window.location.href = '/equipe';
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao apagar.');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="flex items-center gap-1.5 text-xs font-bold bg-red-100 text-red-800 hover:bg-red-200 border border-red-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
    >
      <Trash2 size={14} /> {pending ? 'Apagando…' : 'Apagar perfil permanentemente'}
    </button>
  );
}
