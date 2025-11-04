import { createClient } from '@op/api/serverClient';
import { superAdminDomain } from '@op/core';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const client = await createClient();
  const user = await client.account.getMyAccount();

  if (!user || !user.email.endsWith(`@${superAdminDomain}`)) {
    notFound();
  }

  return (
    <div className="flex size-full items-center justify-center">
      <p className="text-xl">Coming Soon</p>
    </div>
  );
}
