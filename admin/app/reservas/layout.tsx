import TabNav from '@/components/TabNav';
import { GROUP_TABS } from '@/lib/nav';

export default function ReservasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TabNav tabs={GROUP_TABS.reservas} />
      {children}
    </>
  );
}
