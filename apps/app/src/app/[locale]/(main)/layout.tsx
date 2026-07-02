import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { shouldRedirectToOnboarding } from '@/utils/onboarding';
import { assertWalledGardenAccess } from '@/utils/walledGarden';
import { SidebarLayout, SidebarProvider } from '@op/ui/Sidebar';
import { redirect } from 'next/navigation';
import Script from 'next/script';

import { SidebarNav } from '@/components/SidebarNav';
import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

export const dynamic = 'force-dynamic';

// Must match the API's IFRAMELY_CDN_URL so embed.js and the iframe URLs it
// upgrades come from the same host (our caching proxy instead of iframely).
const iframelyCdnUrl =
  process.env.NEXT_PUBLIC_IFRAMELY_CDN_URL ?? '//cdn.iframe.ly';

/**
 * Main app layout — the front door for the walled garden. This route group is
 * closed-network only; public surfaces live in `(no-header)`.
 */
const AppRoot = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  await assertWalledGardenAccess(user);

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
      <Script async src={`${iframelyCdnUrl}/embed.js`}></Script>
    </div>
  );
};

export default AppRoot;
