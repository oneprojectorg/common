'use client';

import { isSafeRedirectPath } from '@op/common/client';
import { useAuthUser } from '@op/hooks';
import { redirect, usePathname } from 'next/navigation';

export const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthUser();
  const pathname = usePathname();

  const loginUrl = isSafeRedirectPath(pathname)
    ? `/login?redirect=${encodeURIComponent(pathname)}`
    : '/login';

  if (user?.data?.error) {
    redirect(loginUrl);
  }

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    redirect(loginUrl);
  }

  return children;
};
