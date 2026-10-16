import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import {
  buildOnboardingRedirect,
  shouldRedirectToOnboarding,
} from '@/utils/onboarding';
import { assertWalledGardenAccess } from '@/utils/walledGarden';
import { SidebarInset, SidebarProvider } from '@op/sense/Sidebar';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { PolicyReacceptanceModal } from '@/components/PolicyReacceptanceModal';
import { SidebarNav } from '@/components/SidebarNav';
import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

export const dynamic = 'force-dynamic';

/**
 * Main app layout — the front door for the walled garden. This route group is
 * closed-network only; public surfaces live in `(no-header)`.
 */
const AppRoot = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  // Onboarding is asked first, because /start admits a non-member and this
  // gate does not. Gating first met a not-yet-onboarded account with a 403 it
  // could never clear — the flow built for that account was on the other side
  // of the wall.
  if (shouldRedirectToOnboarding(user)) {
    const requestHeaders = await headers();
    redirect(
      buildOnboardingRedirect(
        requestHeaders.get('x-pathname'),
        requestHeaders.get('x-search'),
      ),
    );
  }

  await assertWalledGardenAccess(user);

  // SidebarProvider writes `sidebar_state` but can't read it back on load.
  const cookieStore = await cookies();
  const isSidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <div className="flex size-full max-h-full flex-col">
      <UserProvider initialUser={user}>
        <PolicyReacceptanceModal />
        <SidebarProvider
          defaultOpen={isSidebarOpen}
          style={{ '--sidebar-width': '19rem' } as React.CSSProperties}
          className="min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SiteHeader />
          <div
            style={{ '--header-height': '3.75rem' } as React.CSSProperties}
            // Only the main well scrolls, so the sidebar's scroll can't chain into the page.
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background sm:flex-row"
          >
            <SidebarNav />
            <SidebarInset className="min-h-0 overflow-y-auto">
              <AppLayout>{children}</AppLayout>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </UserProvider>
    </div>
  );
};

export default AppRoot;
