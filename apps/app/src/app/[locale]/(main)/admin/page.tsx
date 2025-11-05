import { createClient } from '@op/api/serverClient';
import { platformAdminEmailDomain } from '@op/core';
import { notFound } from 'next/navigation';

import { PlatformStats } from '@/components/screens/PlatformAdmin';

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
    <div className="flex w-full items-center justify-center p-8">
      <PlatformStats />
    </div>
  );
}
