import { UserProvider } from '@/utils/UserProvider';
import { trpcNext } from '@op/api/vanilla';
import { redirect } from 'next/navigation';

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const client = await trpcNext();
  const user = await client.account.getMyAccount.query();

  if (user?.organizationUsers?.length === 0) {
    redirect('/en/start');
  }

  return <UserProvider>{children}</UserProvider>;
};

export default Layout;
