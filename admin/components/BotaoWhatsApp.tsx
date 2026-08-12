'use client';

import { linkWhatsApp, numeroWhatsApp } from '@/lib/whatsapp';

/**
 * Botão que abre a conversa do WhatsApp já com o número e o texto prontos.
 *
 * Client component porque a escolha entre WhatsApp Web e app depende do
 * `navigator` — que só existe no browser. O resto da tela de Leads continua
 * server component.
 */
export default function BotaoWhatsApp({
  numero,
  texto,
  tamanho = 'normal',
}: {
  numero: string | null;
  texto: string;
  tamanho?: 'normal' | 'pequeno';
}) {
  // Sem número utilizável não adianta oferecer o botão: abriria o WhatsApp sem
  // destino e daria a impressão de que algo quebrou. Melhor não existir.
  if (!numeroWhatsApp(numero)) return null;

  const classe = tamanho === 'pequeno'
    ? 'text-[11px] px-2 py-0.5'
    : 'text-xs px-3 py-1.5';

  return (
    <button
      type="button"
      onClick={() => window.open(linkWhatsApp(numero, texto), '_blank')}
      className={`bg-[#25D366] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity ${classe}`}
    >
      WhatsApp
    </button>
  );
}
