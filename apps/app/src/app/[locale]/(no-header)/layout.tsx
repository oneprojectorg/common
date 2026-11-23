import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import {
  buildOnboardingRedirect,
  shouldRedirectToOnboarding,
} from '@/utils/onboarding';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { PolicyReacceptanceModal } from '@/components/PolicyReacceptanceModal';

export const dynamic = 'force-dynamic';

const Layout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) => {
  const user = await getUser();

  if (shouldRedirectToOnboarding(user)) {
    const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
    redirect(
      buildOnboardingRedirect(
        locale,
        requestHeaders.get('x-pathname'),
        requestHeaders.get('x-search'),
      ),
    );
  }

  return (
    <UserProvider initialUser={user}>
      <PolicyReacceptanceModal />
      {children}
    </UserProvider>
  );
};

export default Layout;
