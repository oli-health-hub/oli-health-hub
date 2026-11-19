import TabNav from '@/components/TabNav';
import { GROUP_TABS } from '@/lib/nav';

// Grupo `(lista)`: a barra de abas aparece na lista e nas abas irmãs, não na ficha (`/medicos/[id]`).
export default function ProfissionaisLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TabNav tabs={GROUP_TABS.medicos} />
      {children}
    </>
  );
}
