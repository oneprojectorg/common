import { UserProvider } from '@/utils/UserProvider';
import { getUser } from '@/utils/getUser';
import { SidebarProvider } from '@op/ui/Sidebar';

import { SiteHeader } from '@/components/SiteHeader';
import PageError from '@/components/screens/PageError';

export default async function Forbidden() {
  const user = await getUser();

  return (
    <div className="flex size-full flex-col">
      <UserProvider initialUser={user}>
        <SidebarProvider>
          <SiteHeader />
          <PageError error={new Error('UNAUTHORIZED')} />
        </SidebarProvider>
      </UserProvider>
    </div>
  );
}
