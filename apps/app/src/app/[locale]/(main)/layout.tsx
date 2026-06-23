import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { shouldRedirectToOnboarding } from '@/utils/onboarding';
import { SidebarLayout, SidebarProvider } from '@op/ui/Sidebar';
import { forbidden, redirect } from 'next/navigation';
import Script from 'next/script';

import { SidebarNav } from '@/components/SidebarNav';
import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

export const dynamic = 'force-dynamic';

/**
 * Main app layout — the single front door for the "walled garden". Everything
 * under this route group is closed-network only; public surfaces (decision
 * views, public profiles) live in `(no-header)` and are not gated here.
 *
 * User data fetch is cached so child components can reuse it without extra requests.
 */
const AppRoot = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  // Not a network member (no session, anonymous, or not allow-listed) → show the
  // walled-garden screen instead of letting the shell mount and then fail
  // piecemeal on network-gated queries. Reuses the locale `forbidden` boundary.
  if (!user?.isNetworkMember) {
    forbidden();
  }

  if (shouldRedirectToOnboarding(user)) {
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
