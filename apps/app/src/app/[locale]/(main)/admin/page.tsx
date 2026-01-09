import { createClient } from '@op/api/serverClient';
import { isUserEmailPlatformAdmin } from '@op/common';
import { notFound } from 'next/navigation';

import { PlatformStats, UsersTable } from '@/components/screens/PlatformAdmin';
import { PlatformAdminHeader } from '@/components/screens/PlatformAdmin/PlatformAdminHeader';

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic';

/** Platform admin page - restricted to super admin users only */
export default async function AdminPage() {
  const client = await createClient();
  const user = await client.account.getMyAccount();

  // Verify user is a platform admin
  if (!isUserEmailPlatformAdmin(user.email)) {
    notFound();
  }

  return (
    <div className="gap-8 p-8 flex w-full flex-col">
      <PlatformAdminHeader />
      <PlatformStats />
      <UsersTable />
    </div>
  );
}
