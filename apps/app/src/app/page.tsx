'use client';

import { trpc } from '@op/api/client';
import { useAuthUser } from '@op/hooks';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';

const MainPage = () => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: account, isPending } = trpc.account.getMyAccount.useQuery();

  if (account) {
    posthog.identify(account.id, { email: account.email, name: account.name });
  }

  if (authUser?.data && !isPending) {
    if (authUser.data.user == null) {
      router.push('/login');

      return;
    }

    if (account?.organizationUsers?.length) {
      router.push('/');

      return;
    }

    router.push('/start');
  }

  return null;
};

export default MainPage;
