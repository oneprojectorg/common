import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import {
  buildOnboardingRedirect,
  shouldRedirectToOnboarding,
} from '@/utils/onboarding';
import { assertWalledGardenAccess } from '@/utils/walledGarden';
import { SidebarInset, SidebarProvider } from '@op/sense/Sidebar';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Script from 'next/script';

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

  await assertWalledGardenAccess(user);

  if (shouldRedirectToOnboarding(user)) {
    const requestHeaders = await headers();
    redirect(
      buildOnboardingRedirect(
        requestHeaders.get('x-pathname'),
        requestHeaders.get('x-search'),
      ),
    );
  }

  return (
    <div className="flex size-full max-h-full flex-col">
      <UserProvider initialUser={user}>
        <PolicyReacceptanceModal />
        {/* TODO(sense): Figma nav redesign pending. shadcn's canonical
            Sidebar+SidebarInset can't express a full-width header sitting above
            the sidebar, so we keep the op/ui arrangement: the provider is a
            flex column (header on top), with the sidebar + content as a row
            below. defaultOpen={false} preserves the op/ui default of a nav that
            stays collapsed until the header trigger opens it. */}
        <SidebarProvider
          defaultOpen={false}
          className="min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SiteHeader />
          <div
            // --header-height offsets the desktop sidebar's fixed panel so it
            // starts below the full-width header (see SidebarNav). Matches the
            // 60px SiteHeader.
            style={{ '--header-height': '3.75rem' } as React.CSSProperties}
            className="relative flex size-full flex-1 flex-col overflow-y-auto bg-background sm:flex-row"
          >
            <SidebarNav />
            <SidebarInset>
              <AppLayout>{children}</AppLayout>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </UserProvider>
      {/* Served by our own edge-cached proxy (app/api/embeds) instead of
          cdn.iframe.ly, so embed loads don't hit iframely's billed CDN. */}
      <Script async src="/api/embeds/embed.js"></Script>
    </div>
  );
};

export default AppRoot;
