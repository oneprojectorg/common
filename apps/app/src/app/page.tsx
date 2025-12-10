'use client';

import { trpc } from '@op/api/client';
import { useAuthUser } from '@op/hooks';
import { useRouter } from 'next/navigation';

import ComingSoonPage from '@/components/screens/ComingSoon/ComingSoonPage';

const MainPage = () => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: account, isPending } = trpc.account.getMyAccount.useQuery();

  if (authUser?.data && !isPending) {
    if (authUser.data.user === null) {
      return <ComingSoonPage />;
    }

    if (account?.organizationUsers?.length === 0) {
      router.push('/start');

      return;
    }
  }

  return null;
};

export default MainPage;
