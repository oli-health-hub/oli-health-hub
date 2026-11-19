'use client';

import { useState, useTransition } from 'react';
import { sendBroadcastPush } from '@/app/actions';

export function BroadcastForm() {
  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setResult(null);
    startTransition(async () => {
      const res = await sendBroadcastPush(formData);
      setResult(res);
      setTitle('');
      setBody('');
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Título</label>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={65}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Ex: Novidade no OLI Health Hub"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mensagem</label>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={180}
          required
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Ex: Já pode reservar sala aos sábados, mesmo horário da semana."
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-oli-green text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {pending ? 'Enviando…' : 'Enviar pra todos'}
      </button>
      {result && (
        <p className="text-sm text-gray-600">
          {result.sent > 0
            ? `Enviado para ${result.sent} de ${result.total} device(s).`
            : 'Nenhum device com push registrado ainda.'}
        </p>
      )}
    </form>
  );
}
