'use client';

import { getSafeRedirectPath } from '@op/common/client';
import { useAuthUser } from '@op/hooks';
import { useSearchParams } from 'next/navigation';

import { LinkAccountPanel } from '@/components/LinkAccountPanel';
import { LoginPanel } from '@/components/LoginPanel';

const LoginPage = () => {
  const user = useAuthUser();
  const searchParams = useSearchParams();
  const redirectParam = getSafeRedirectPath(searchParams.get('redirect'));
  const isLinkMode = searchParams.get('link') === '1';

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  // Link mode: an anonymous visitor upgrading to a full account. Must come
  // before the checks below, which would otherwise bounce them to LoginPanel.
  // LinkAccountPanel links the email onto the existing anon user.
  if (isLinkMode && user.data?.user?.is_anonymous) {
    return <LinkAccountPanel />;
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
  const target = redirectParam ?? '/';
  window.location.assign(target);
  return null;
};

export default LoginPage;
