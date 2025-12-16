'use client';

import { trpc } from '@op/api/client';
import { useAuthUser } from '@op/hooks';
import { useRouter } from 'next/navigation';

import { ComingSoonScreen } from '@/components/screens/ComingSoon/ComingSoonScreen';

const MainPage = () => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: account, isPending } = trpc.account.getMyAccount.useQuery();

  if (authUser?.data && !isPending) {
    if (authUser.data.user === null) {
      return <ComingSoonScreen />;
    }

    if (account?.organizationUsers?.length === 0) {
      router.push('/start');

      return;
    }
  }

  return null;
};

export default MainPage;
