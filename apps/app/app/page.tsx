'use client';

import LoginDialog from '@/components/LoginDialog';
import { redirect } from 'next/navigation';

import { useAuthUser } from '@op/hooks';

const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthUser();

  if (!user || user.isFetching || user.isPending) return null;

  if (user.isFetchedAfterMount && !user.isFetching && !user.data?.user) {
    redirect('/login');
  }

  return children;
};

const MainPage = () => {
  return (
    <AuthWrapper>
      <div className="container flex min-h-0 grow flex-col px-0 pt-4">
        Hello world!
      </div>
    </AuthWrapper>
  );
};

export default MainPage;
