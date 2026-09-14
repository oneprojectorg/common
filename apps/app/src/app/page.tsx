'use client';
import { shouldRedirectToOnboarding } from '@/utils/onboarding';
import { useTRPC } from '@op/api/client';
import { useAuthUser } from '@op/hooks';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { ComingSoonScreen } from '@/components/screens/ComingSoon/ComingSoonScreen';

const MainPage = () => {
  const trpc = useTRPC();
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: account, isFetching } = useQuery(
    trpc.account.getMyAccount.queryOptions(),
  );

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
