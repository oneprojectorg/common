import { UserProvider } from '@/utils/UserProvider';
import Script from 'next/script';
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
      <Script async src="//cdn.iframe.ly/embed.js"></Script>
    </div>
  );
};

export default AppRoot;
