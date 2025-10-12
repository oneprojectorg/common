import { setupSSR } from '@/utils/setupSSR';
import { getMessages } from 'next-intl/server';

// import { headers } from 'next/headers';
// import { redirect } from 'next/navigation';

import { I18nProvider } from '@/lib/i18n';

const AppLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) => {
  setupSSR({ params });
  const { locale } = await params;
  // const headersList = await headers();
  // const pathname = headersList.get('x-pathname') || headersList.get('x-url');

  // if (!pathname.startsWith('/start')) {
  // try {
  // const trpcNext = await createTRPCNextClient();
  // const user = await trpcNext.account.getMyAccount.query();

  // // if we have a user and no orgs, redirect to onboarding
  // if (!user?.organizationUsers?.length) {
  // redirect('/start');
  // }
  // } catch (error) {
  // console.error(error);
  // }
  // }

  const messages = await getMessages({ locale });

  return (
    <I18nProvider locale={locale} messages={messages}>
      {children}
    </I18nProvider>
  );
};

export default AppLayout;
