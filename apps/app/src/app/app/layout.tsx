import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

const AppRoot = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex size-full max-h-full flex-col overflow-hidden">
      <SiteHeader />
      <AppLayout>{children}</AppLayout>
    </div>
  );
};

export default AppRoot;
