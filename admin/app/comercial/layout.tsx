import TabNav from '@/components/TabNav';
import { GROUP_TABS } from '@/lib/nav';

// A barra de abas fica fixa no topo e o conteúdo rola abaixo dela. Assim telas de altura
// total (Conversas) usam só o espaço que sobra, em vez de estourar a altura do `main`.
export default function ComercialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <TabNav tabs={GROUP_TABS.comercial} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
