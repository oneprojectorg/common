import { createClient } from '@op/api/serverClient';
import { platformAdminEmailDomain } from '@op/core';
import { notFound } from 'next/navigation';

import { PlatformStats } from '@/components/screens/PlatformAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const client = await createClient();
  const user = await client.account.getMyAccount();
  const userEmailDomain = user.email.split('@')[1];

  if (userEmailDomain !== platformAdminEmailDomain) {
    notFound();
  }

  return (
    <div className="flex w-full items-center justify-center p-8">
      <PlatformStats />
    </div>
  );
}
