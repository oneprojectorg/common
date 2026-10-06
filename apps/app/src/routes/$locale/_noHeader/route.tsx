import { getNoHeaderLayoutUser } from '@/server/layouts.functions';
import { UserProvider } from '@/utils/UserProvider';
import { Outlet, createFileRoute } from '@tanstack/react-router';

import { getDestination } from '@/lib/destination';

import { PolicyReacceptanceModal } from '@/components/PolicyReacceptanceModal';

export const Route = createFileRoute('/$locale/_noHeader')({
  loader: ({ location }) =>
    getNoHeaderLayoutUser({ data: getDestination(location) }),
  // Like a persistent layout, the check runs when the group is entered, not on
  // every navigation inside it. `router.invalidate()` re-runs it.
  staleTime: Infinity,
  component: NoHeaderLayout,
});

function NoHeaderLayout() {
  const user = Route.useLoaderData();

  return (
    <UserProvider initialUser={user}>
      <PolicyReacceptanceModal />
      <Outlet />
    </UserProvider>
  );
}
