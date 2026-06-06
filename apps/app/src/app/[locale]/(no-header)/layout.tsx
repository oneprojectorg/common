import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getUser();

  if (!user?.onboardedAt) {
    redirect('/en/start');
  }

  return <UserProvider initialUser={user}>{children}</UserProvider>;
};

export default Layout;
