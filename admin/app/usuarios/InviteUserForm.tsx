'use client';

import { useRef, useState, useTransition } from 'react';
import { inviteUser } from '@/app/actions';
import { UserPlus, Send, Loader2 } from 'lucide-react';

export function InviteUserForm() {
  const [status, setStatus]   = useState<'idle' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setStatus('idle');

    startTransition(async () => {
      try {
        await inviteUser(data);
        setStatus('ok');
        setMessage(`Convite enviado para ${data.get('email')}`);
        formRef.current?.reset();
      } catch (err: unknown) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Erro ao enviar convite.');
      }
    });
  }

  return (
    <section>
      <h2 className="text-sm font-bold text-oli-dark mb-3 flex items-center gap-2">
        <UserPlus size={14} className="text-oli-green" />
        Convidar usuário
      </h2>

      <div className="bg-white rounded-2xl border border-oli-border p-4">
        <form ref={formRef} onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider block mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="nome@exemplo.com"
              className="w-full border border-oli-border rounded-xl px-3 py-2.5 text-sm text-oli-dark placeholder:text-oli-lgray focus:outline-none focus:ring-2 focus:ring-oli-green/30 focus:border-oli-green transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 bg-oli-green text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-oli-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {pending
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />
            }
            Enviar convite
          </button>
        </form>

        {status === 'ok' && (
          <p className="mt-3 text-sm text-oli-green font-medium flex items-center gap-1.5">
            ✓ {message}
          </p>
        )}
        {status === 'error' && (
          <p className="mt-3 text-sm text-oli-red font-medium">
            {message}
          </p>
        )}

        <p className="mt-3 text-[11px] text-oli-lgray">
          O usuário receberá um e-mail com link para criar sua senha. Após o cadastro, promova para admin se necessário.
        </p>
      </div>
    </section>
  );
}
