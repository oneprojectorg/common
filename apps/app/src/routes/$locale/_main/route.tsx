import { getMainLayoutUser } from '@/server/layouts.functions';
import { UserProvider } from '@/utils/UserProvider';
import { SidebarInset, SidebarProvider } from '@op/sense/Sidebar';
import { Outlet, createFileRoute } from '@tanstack/react-router';

import { getDestination } from '@/lib/destination';

import { PolicyReacceptanceModal } from '@/components/PolicyReacceptanceModal';
import { SidebarNav } from '@/components/SidebarNav';
import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

/**
 * Main app layout — the front door for the walled garden. This route group is
 * closed-network only; public surfaces live in `_noHeader`.
 */
export const Route = createFileRoute('/$locale/_main')({
  loader: ({ location }) =>
    getMainLayoutUser({ data: getDestination(location) }),
  // Like a persistent layout, the gate runs when the group is entered, not on
  // every navigation inside it. `router.invalidate()` re-runs it.
  staleTime: Infinity,
  component: MainLayout,
});

function MainLayout() {
  const user = Route.useLoaderData();

  return (
    <div className="flex size-full max-h-full flex-col">
      <UserProvider initialUser={user}>
        <PolicyReacceptanceModal />
        <SidebarProvider
          defaultOpen={false}
          className="min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SiteHeader />
          <div
            data-route-scroll
            style={{ '--header-height': '3.75rem' } as React.CSSProperties}
            className="relative flex size-full flex-1 flex-col overflow-y-auto bg-background sm:flex-row"
          >
            <SidebarNav />
            <SidebarInset>
              <AppLayout>
                <Outlet />
              </AppLayout>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </UserProvider>
    </div>
  );
}
