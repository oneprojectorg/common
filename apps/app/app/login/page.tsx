'use client';

import { FullScreenSplitAside } from '@/components/layout/split/FullScreenSplitAside';
import { FullScreenSplitLayout } from '@/components/layout/split/FullScreenSplitLayout';
import { FullScreenSplitMain } from '@/components/layout/split/FullScreenSplitMain';
import LoginDialog from '@/components/LoginDialog';
import Image from 'next/image';
import { redirect } from 'next/navigation';

import { APP_NAME } from '@op/core';
import { useAuthUser } from '@op/hooks';

const LoginPageWithLayout = () => {
  return (
    <FullScreenSplitLayout>
      <FullScreenSplitMain>
        <section>
          <div className="flex items-center gap-2">
            <Image
              src="/op.png"
              alt="OP"
              width={48}
              height={48}
              className="size-4"
            />
            One Project
            <div>
              <span className="border-orange text-orange2 rounded border p-1 font-mono text-xs">
                {APP_NAME}
              </span>
            </div>
          </div>
        </section>
        <section className="flex size-full items-center justify-center">
          {/* TODO: replace with inline form */}
          <LoginDialog open />
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
