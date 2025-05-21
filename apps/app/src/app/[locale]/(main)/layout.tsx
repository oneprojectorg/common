import { UserProvider } from '@/utils/UserProvider';
import { Suspense } from 'react';

import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

const AppRoot = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex size-full max-h-full flex-col overflow-hidden">
      <Suspense fallback={null}>
        <UserProvider>
          <SiteHeader />
          <AppLayout>{children}</AppLayout>
        </UserProvider>
      </Suspense>
    </div>
  );
};

export default AppRoot;
