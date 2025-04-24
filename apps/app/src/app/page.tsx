'use client';

import { useRouter } from 'next/navigation';

import { trpc } from '@op/trpc/client';
import { useAuthUser } from '@op/hooks';

const MainPage = () => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: account, isPending } = trpc.account.getMyAccount.useQuery();

  console.log('AUTH USER >>>>', authUser);
  if (authUser?.data && !isPending) {
    console.log('USER >>>>', isPending, account?.organizationUsers?.length);
    if (authUser.data.user == null) {
      router.push('/login');
      return;
    }

    if (account?.organizationUsers?.length) {
      router.push('/app/org');
      return;
    }

    router.push('/start');
  }
  return null;
};

export default MainPage;
