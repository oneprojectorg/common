import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { shouldRedirectToOnboarding } from '@/utils/onboarding';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  if (shouldRedirectToOnboarding(user)) {
    redirect('/en/start');
  }

  return <UserProvider initialUser={user}>{children}</UserProvider>;
};

export default Layout;
