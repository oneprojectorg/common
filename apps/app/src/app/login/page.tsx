'use client';

import { useAuthUser } from '@op/hooks';
import { redirect, useSearchParams } from 'next/navigation';

import { LoginPanel } from '@/components/LoginPanel';

const LoginPageWithLayout = () => {
  return <LoginPanel />;
};

const LoginPage = () => {
  const user = useAuthUser();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    return <LoginPageWithLayout />;
  }

  if (
    redirectParam?.startsWith('/') &&
    !redirectParam.startsWith('//') &&
    !redirectParam.startsWith('/login')
  ) {
    redirect(redirectParam);
  }

  redirect('/');
};

export default LoginPage;
