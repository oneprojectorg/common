import { UserProvider } from '@/utils/UserProvider';
import { trpcNext } from '@op/api/vanilla';
import { redirect } from 'next/navigation';
import Script from 'next/script';

import { SiteHeader } from '@/components/SiteHeader';
import { AppLayout } from '@/components/layout/split/AppLayout';

const AppRoot = async ({ children }: { children: React.ReactNode }) => {
  const client = await trpcNext();
  const user = await client.account.getMyAccount.query();

  if (user?.organizationUsers?.length === 0) {
    redirect('/en/start');
  }

  return (
    <div className="flex size-full max-h-full flex-col overflow-hidden">
      <UserProvider>
        <SiteHeader />
        <AppLayout>{children}</AppLayout>
      </UserProvider>
      <Script async src="//cdn.iframe.ly/embed.js"></Script>
    </div>
  );
};

export default AppRoot;
