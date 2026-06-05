import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { redirect } from 'next/navigation';
import Script from 'next/script';

import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

/**
 * Shared layout for all authenticated app routes.
 *
 * (main) and (no-header) were previously sibling route groups with their own
 * layouts. Navigating between them swapped the layout segment, which under
 * Turbopack made the server serialize the outgoing group's client component
 * references against the incoming route's partial client-reference manifest —
 * producing intermittent "Could not find module ... in React Client Manifest"
 * 500s (Asana 1213980160576009). Sharing a single layout makes cross-route
 * navigation a leaf swap (no layout-segment change), so no cross-manifest
 * lookup happens. Chrome (header/sidebar) is toggled client-side in AppShell.
 */
const AppRoot = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  if (!user?.onboardedAt) {
    redirect('/en/start');
  }

  return (
    <UserProvider initialUser={user}>
      <AppShell>{children}</AppShell>
      <Script async src="//cdn.iframe.ly/embed.js"></Script>
    </UserProvider>
  );
};

export default AppRoot;
