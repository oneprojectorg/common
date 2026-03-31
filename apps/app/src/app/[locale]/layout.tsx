import { setupSSR } from '@/utils/setupSSR';

import { ReactAriaRouterProvider } from '@/components/ReactAriaRouterProvider';

const AppLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) => {
  setupSSR({ params });

  return <ReactAriaRouterProvider>{children}</ReactAriaRouterProvider>;
};

export default AppLayout;
