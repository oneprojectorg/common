'use client';

import LoginDialog from '@/components/LoginDialog';

import { useAuthUser } from '@op/hooks';

const MainPage = () => {
  const user = useAuthUser();

  if (!user || user.isFetching || user.isPending)
    return null;

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    return <LoginDialog open />;
  }

  return (
    <div className="container flex min-h-0 grow flex-col px-0 pt-4">
      Hello world!
    </div>
  );
};

export default MainPage;
