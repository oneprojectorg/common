'use client';

import { LoginPanel } from '@/components/LoginPanel';
import { redirect } from 'next/navigation';

import { useAuthUser } from '@op/hooks';

const LoginPageWithLayout = () => {
  return <LoginPanel />;
};

const LoginPage = () => {
  const user = useAuthUser();

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    return <LoginPageWithLayout />;
  }

  redirect('/');
};

export default LoginPage;
