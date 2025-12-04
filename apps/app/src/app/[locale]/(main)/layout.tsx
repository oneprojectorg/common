import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { SidebarLayout, SidebarProvider } from '@op/ui/Sidebar';
import { redirect } from 'next/navigation';
import Script from 'next/script';

import { SidebarNav } from '@/components/SidebarNav';
import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

export const dynamic = 'force-dynamic';

/**
 * Main app layout - checks for organization membership then renders shell.
 * User data fetch is cached so child components can reuse it without extra requests.
 */
const AppRoot = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  if (user?.organizationUsers?.length === 0) {
    redirect('/en/start');
  }

  return (
    <div className="flex size-full max-h-full flex-col">
      <UserProvider initialUser={user}>
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
