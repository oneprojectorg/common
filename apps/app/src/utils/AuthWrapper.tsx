'use client';

import { useAuthUser } from '@op/hooks';
import { redirect } from 'next/navigation';

export const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthUser();

  if (user?.data?.error) {
    redirect('/login');
  }

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    redirect('/login');
  }

  return children;
};
