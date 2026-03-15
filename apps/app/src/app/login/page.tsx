'use client';

import { isSafeRedirectPath } from '@op/common/client';
import { useAuthUser } from '@op/hooks';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { LoginPanel } from '@/components/LoginPanel';

const LoginPageWithLayout = () => {
  return <LoginPanel />;
};

const LoginPage = () => {
  const user = useAuthUser();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const isAuthenticated =
    user?.isFetchedAfterMount && !user.isFetching && !!user.data?.user;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const target = isSafeRedirectPath(redirectParam) ? redirectParam : '/';
    window.location.assign(target);
  }, [isAuthenticated, redirectParam]);

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    return <LoginPageWithLayout />;
  }

  // Authenticated — redirecting via window.location.assign in effect above
  return null;
};

export default LoginPage;
