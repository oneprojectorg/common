import { UserProvider } from '@/utils/UserProvider';
import { createServerClient } from '@op/api/vanilla';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const client = await createServerClient();
  const user = await client.account.getMyAccount();

  if (user?.organizationUsers?.length === 0) {
    redirect('/en/start');
  }

  return <UserProvider>{children}</UserProvider>;
};

export default Layout;
