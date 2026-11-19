import TabNav from '@/components/TabNav';
import { GROUP_TABS } from '@/lib/nav';

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TabNav tabs={GROUP_TABS.financeiro} />
      {children}
    </>
  );
}
