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

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  if (shouldRedirectToOnboarding(user)) {
    const requestHeaders = await headers();
    redirect(
      buildOnboardingRedirect(
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
