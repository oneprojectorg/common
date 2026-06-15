'use client';

import { shouldRedirectToOnboarding } from '@/utils/onboarding';
import { trpc } from '@op/api/client';
import { useAuthUser } from '@op/hooks';
import { useRouter } from 'next/navigation';

import { ComingSoonScreen } from '@/components/screens/ComingSoon/ComingSoonScreen';

const MainPage = () => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: account, isFetching } = trpc.account.getMyAccount.useQuery();

  if (authUser?.data && !isFetching) {
    if (authUser.data.user === null) {
      return <ComingSoonScreen />;
    }

    if (shouldRedirectToOnboarding(account)) {
      router.push('/start');

      return null;
    }
  }

  return null;
};

export default MainPage;
