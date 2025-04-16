import { redirect } from 'next/navigation';

import { useAuthUser } from '@op/hooks';

// TODO: handle this in the middleware
export const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthUser();

  if (!user || user.isFetching || user.isPending) {
    return null;
  }

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    redirect('/login');
  }

  return children;
};
