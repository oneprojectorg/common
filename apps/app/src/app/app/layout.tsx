import { AppLayout } from '@/components/layout/split/AppLayout';
import { SiteHeader } from '@/components/SiteHeader';

const AppRoot = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex size-full max-h-full flex-col overflow-hidden">
      <SiteHeader />
      <AppLayout>{children}</AppLayout>
    </div>
  );
};

export default AppRoot;
