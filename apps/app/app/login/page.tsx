'use client';

import { CommonLogo } from '@/components/CommonLogo';
import { FullScreenSplitAside } from '@/components/layout/split/FullScreenSplitAside';
import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';
import { LoginPanel } from '@/components/LoginPanel';
import { OPLogo } from '@/components/OPLogo';
import { redirect } from 'next/navigation';

import { useAuthUser } from '@op/hooks';

const LoginPageWithLayout = () => {
  return (
    <FullScreenSplitLayout>
      <FullScreenSplitMain>
        <section>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <OPLogo />
              <CommonLogo />
            </div>
          </div>
        </section>
        <section className="flex size-full items-center justify-center">
          <LoginPanel />
        </section>
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
