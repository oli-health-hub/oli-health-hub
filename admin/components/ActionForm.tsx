'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { ActionResult } from '@/app/actions';

/**
 * Formulário que chama uma server action e mostra o resultado na tela.
 *
 * Existe porque `<form action={fn}>` direto não dá retorno nenhum: o botão parece
 * parado, a pessoa clica de novo e o lançamento sai duplicado. Aqui o botão fica
 * desabilitado enquanto processa, a mensagem de sucesso ou de erro aparece abaixo
 * e o formulário é limpo ao concluir.
 */
export default function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Processando…',
  formClassName,
  footerClassName,
  buttonClassName,
  confirmMessage,
  resetOnSuccess = true,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  formClassName?: string;
  footerClassName?: string;
  buttonClassName: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    const form = e.currentTarget;
    const data = new FormData(form);
    setResult(null);
    setPending(true);

    action(data)
      .then((r) => {
        setResult(r);
        if (r.ok && resetOnSuccess) form.reset();
      })
      .catch(() => {
        setResult({ ok: false, message: 'Não foi possível concluir. Verifique a conexão e confira o histórico antes de tentar de novo.' });
      })
      .finally(() => setPending(false));
  };

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      {children}
      <div className={footerClassName}>
        <button type="submit" disabled={pending} className={`${buttonClassName} disabled:opacity-60 disabled:cursor-not-allowed`}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {result && (
          <p
            role={result.ok ? 'status' : 'alert'}
            className={`mt-2 text-xs font-medium ${result.ok ? 'text-oli-green' : 'text-oli-red'}`}
          >
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
