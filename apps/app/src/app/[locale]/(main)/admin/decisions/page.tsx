import { createClient } from '@op/api/serverClient';
import { isUserEmailPlatformAdmin } from '@op/common';
import { notFound } from 'next/navigation';

import { DecisionsTable } from '@/components/screens/PlatformAdmin/DecisionsTable';
import { PlatformAdminHeader } from '@/components/screens/PlatformAdmin/PlatformAdminHeader';

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic';

/** Platform admin decisions page - restricted to super admin users only */
export default async function AdminDecisionsPage() {
  const client = await createClient();
  const user = await client.account.getMyAccount();

  if (!isUserEmailPlatformAdmin(user.email)) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-8 p-8">
      <PlatformAdminHeader />
      <DecisionsTable />
    </div>
  );
}
