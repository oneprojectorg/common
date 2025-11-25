'use client';

import { trpc } from '@op/api/client';
import { useAuthUser } from '@op/hooks';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

const MainPage = () => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: account, isPending } = useQuery({
    queryKey: [['account', 'getMyAccount']],
    queryFn: () => trpc.account.getMyAccount.query(),
  });

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
