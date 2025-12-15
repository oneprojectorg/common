import { Suspense } from 'react';

import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { SidebarLayout, SidebarProvider } from '@op/ui/Sidebar';
import { redirect } from 'next/navigation';
import Script from 'next/script';

import { SidebarNav } from '@/components/SidebarNav';
import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

// Enable Partial Prerendering - static shell with dynamic user content
export const experimental_ppr = true;

/**
 * Wrapper component that fetches user data and handles auth redirect.
 * Wrapped in Suspense to allow the shell to be pre-rendered.
 */
const UserWrapper = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  if (user?.organizationUsers?.length === 0) {
    redirect('/en/start');
  }

  return <UserProvider initialUser={user}>{children}</UserProvider>;
};

/**
 * Main app layout with PPR enabled.
 * The outer shell (sidebar structure, header skeleton) is pre-rendered.
 * User-specific content streams in via Suspense boundaries.
 */
const AppRoot = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex size-full max-h-full flex-col">
      <Suspense>
        <UserWrapper>
          <SidebarProvider>
            <SiteHeader />
            <SidebarLayout>
              <SidebarNav />
              <AppLayout>{children}</AppLayout>
            </SidebarLayout>
          </SidebarProvider>
        </UserWrapper>
      </Suspense>
      <Script async src="//cdn.iframe.ly/embed.js"></Script>
    </div>
  );
};

export default AppRoot;
