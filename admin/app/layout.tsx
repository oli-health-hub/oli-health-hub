import type { Metadata } from 'next';
import './globals.css';
import { createSupabaseServer } from '@/lib/supabase-server';
import Sidebar from '@/components/Sidebar';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'OLI Admin',
  description: 'Painel operacional OLI Health Hub',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Páginas de login renderizam sem sidebar
  const isPublic = !user;
  if (isPublic) {
    return (
      <html lang="pt-BR">
        <body className="min-h-screen bg-oli-bg">{children}</body>
      </html>
    );
  }

  // Conta notificações não lidas para badge da sidebar
  const { count: unreadCount } = await supabase
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null);

  const email = user.email ?? '';

  return (
    <html lang="pt-BR">
      <body className="flex h-screen overflow-hidden bg-oli-bg">
        <Sidebar unreadCount={unreadCount ?? 0} userEmail={email} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
