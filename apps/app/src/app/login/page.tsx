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

  // An anonymous session is not "signed in" for our purposes: the walled-garden
  // gate redirects anonymous users here to authenticate, so treat them like a
  // logged-out visitor and show the panel — otherwise we bounce back into the
  // app and loop.
  if (
    user.isFetchedAfterMount &&
    (!user.data?.user || user.data.user.is_anonymous)
  ) {
    return <LoginPanel />;
  }

  // Signed in: hard-navigate so the authed tree mounts with a fresh query
  // cache (client routing would carry the signed-out null account in).
  const target = isSafeRedirectPath(redirectParam) ? redirectParam : '/';
  window.location.assign(target);
  return null;
};

export default LoginPage;
