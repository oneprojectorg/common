'use client';

import { FullScreenStepperLayout } from '@/components/layout/FullScreenStepperLayout';
import { FullScreenStepperAside } from '@/components/layout/FullScreenStepperLayout/FullScreenStepperAside';
import { FullScreenStepperMain } from '@/components/layout/FullScreenStepperLayout/FullScreenStepperMain';
import LoginDialog from '@/components/LoginDialog';
import Image from 'next/image';
import { redirect } from 'next/navigation';

import { useAuthUser } from '@op/hooks';

const CreateAccount = () => {
  return <div> Create your account</div>;
};

const LoginPageWithLayout = () => {
  return (
    <FullScreenStepperLayout>
      <FullScreenStepperMain>
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
      </FullScreenStepperMain>
      <FullScreenStepperAside />
    </FullScreenStepperLayout>
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
