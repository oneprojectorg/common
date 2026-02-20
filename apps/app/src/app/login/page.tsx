'use client';

import { isSafeRedirectPath } from '@op/common/client';
import { useAuthUser } from '@op/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { LoginPanel } from '@/components/LoginPanel';

const LoginPage = () => {
  const user = useAuthUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  useEffect(() => {
    if (!user || user.isFetching || user.isPending) {
      return;
    }

    if (user.isFetchedAfterMount && !user.data?.user) {
      return;
    }

    if (isSafeRedirectPath(redirectParam)) {
      router.replace(redirectParam);
    } else {
      router.replace('/');
    }
  }, [user, redirectParam, router]);

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    return <LoginPanel />;
  }

  return null;
};

export default LoginPage;
