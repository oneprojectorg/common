import { createClient } from '@op/api/serverClient';
import { isUserPlatformAdmin } from '@op/common';
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
  if (!isUserPlatformAdmin(user)) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-8 p-8">
      <PlatformAdminHeader />
      <PlatformStats />
      <UsersTable />
    </div>
  );
}
