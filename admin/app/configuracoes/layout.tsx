import TabNav from '@/components/TabNav';
import { createSupabaseServer } from '@/lib/supabase-server';
import { GROUP_TABS, FOUNDER_TAB } from '@/lib/nav';
import { isFounder } from '@/lib/founder';

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  // "Meu Recebimento" só aparece para o fundador; a página também barra os demais (notFound).
  const tabs = isFounder(user?.email) ? [...GROUP_TABS.configuracoes, FOUNDER_TAB] : GROUP_TABS.configuracoes;

  return (
    <>
      <TabNav tabs={tabs} />
      {children}
    </>
  );
}
