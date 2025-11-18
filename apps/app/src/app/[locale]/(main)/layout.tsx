import { UserProvider } from '@/utils/UserProvider';
import { createClient } from '@op/api/serverClient';
import { SidebarLayout, SidebarProvider } from '@op/ui/Sidebar';
import { redirect } from 'next/navigation';
import Script from 'next/script';

import { SidebarNav } from '@/components/SidebarNav';
import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

export const dynamic = 'force-dynamic';

const AppRoot = async ({ children }: { children: React.ReactNode }) => {
  const client = await createClient();
  const user = await client.account.getMyAccount();

  if (user?.organizationUsers?.length === 0) {
    redirect('/en/start');
  }

  return (
    <div className="flex size-full max-h-full flex-col">
      <UserProvider>
        <SidebarProvider>
          <SiteHeader />
          <SidebarLayout>
            <SidebarNav />
            <AppLayout>{children}</AppLayout>
          </SidebarLayout>
        </SidebarProvider>
      </UserProvider>
      <Script async src="//cdn.iframe.ly/embed.js"></Script>
    </div>
  );
};

export default AppRoot;
