'use client';

import { isSafeRedirectPath } from '@op/common/client';
import { useAuthUser } from '@op/hooks';
import { useSearchParams } from 'next/navigation';

import { LoginPanel } from '@/components/LoginPanel';

const LoginPage = () => {
  const user = useAuthUser();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  if (user.isFetchedAfterMount && !user.data?.user) {
    return <LoginPanel />;
  }

  // Signed in: hard-navigate so the authed tree mounts with a fresh query
  // cache (client routing would carry the signed-out null account in).
  const target = isSafeRedirectPath(redirectParam) ? redirectParam : '/';
  window.location.assign(target);
  return null;
};

export default LoginPage;
