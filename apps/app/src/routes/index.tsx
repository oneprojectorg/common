import { shouldRedirectToOnboarding } from '@/utils/onboarding';
import { trpc } from '@op/api/client';
import { useAuthUser } from '@op/hooks';
import { createFileRoute } from '@tanstack/react-router';

import { ComingSoonScreen } from '@/components/screens/ComingSoon/ComingSoonScreen';

export const Route = createFileRoute('/')({
  component: MainPage,
});

function MainPage() {
  const authUser = useAuthUser();
  const { data: account, isFetching } = trpc.account.getMyAccount.useQuery();

  if (authUser?.data && !isFetching) {
    if (authUser.data.user === null) {
      return <ComingSoonScreen />;
    }

    if (shouldRedirectToOnboarding(account)) {
      // A full load: `/start` has no locale yet, and only the server's
      // locale redirect can pick one from the visitor's cookie and browser.
      window.location.assign('/start');

      return null;
    }
  }

  return null;
}
