import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { shouldRedirectToOnboarding } from '@/utils/onboarding';
import { redirect } from 'next/navigation';

import { PolicyReacceptanceModal } from '@/components/PolicyReacceptanceModal';

export const dynamic = 'force-dynamic';

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  if (shouldRedirectToOnboarding(user)) {
    redirect('/en/start');
  }

  return (
    <UserProvider initialUser={user}>
      <PolicyReacceptanceModal />
      {children}
    </UserProvider>
  );
};

export default Layout;
