'use client';

import { trpc } from '@op/api/client';
import { useAuthUser } from '@op/hooks';
import { useRouter } from 'next/navigation';

import { OAuthHashErrorHandler } from '@/components/OAuthHashErrorHandler';
import { ComingSoonScreen } from '@/components/screens/ComingSoon/ComingSoonScreen';

const MainPage = () => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: account, isFetching } = trpc.account.getMyAccount.useQuery();

  if (authUser?.data && !isFetching) {
    if (authUser.data.user === null) {
      return <ComingSoonScreen />;
    }

    if (!account?.onboardedAt) {
      router.push('/start');

      return;
    }
  }

  // Only mounted at `/` because Supabase's Site URL config points here, so
  // OAuth provider-side errors (e.g. user cancels Google consent) land on
  // this route with the error in the URL fragment. If Site URL ever moves,
  // mount this handler at the new location too.
  return <OAuthHashErrorHandler />;
};

export default MainPage;
