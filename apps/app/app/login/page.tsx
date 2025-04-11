'use client';

import { FullScreenSplitAside } from '@/components/layout/split/FullScreenSplitAside';
import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';
import LoginDialog from '@/components/LoginDialog';
import Image from 'next/image';
import { redirect } from 'next/navigation';

import { useAuthUser } from '@op/hooks';

const CreateAccount = () => {
  return <div> Create your account</div>;
};

const LoginPageWithLayout = () => {
  return (
    <FullScreenSplitLayout>
      <FullScreenSplitMain>
        <header>
          <Image
            src="/op.png"
            alt="OP Logo"
            width={200}
            height={200}
            className="size-8"
          />
        </header>
        <div className="flex size-full items-center justify-center">
          <LoginDialog />
          <CreateAccount />
        </div>
      </FullScreenSplitMain>
      <FullScreenSplitAside />
    </FullScreenSplitLayout>
  );
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
