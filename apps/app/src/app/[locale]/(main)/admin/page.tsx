import { createClient } from '@op/api/serverClient';
import { platformAdminEmailDomain } from '@op/core';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PlatformStats, UsersList } from '@/components/screens/PlatformAdmin';
import { PlatformAdminHeader } from '@/components/screens/PlatformAdmin/PlatformAdminHeader';
import { UsersListSkeleton } from '@/components/screens/PlatformAdminScreen/UsersList';

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic';

/** Platform admin page - restricted to super admin users only */
export default async function AdminPage() {
  const client = await createClient();
  const user = await client.account.getMyAccount();
  const userEmailDomain = user.email.split('@')[1];

  // Verify user has super admin email domain
  if (userEmailDomain !== platformAdminEmailDomain) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-8 p-8">
      <PlatformAdminHeader />
      <PlatformStats />
      <Suspense fallback={<UsersListSkeleton />}>
        <UsersList />
      </Suspense>
    </div>
  );
}
