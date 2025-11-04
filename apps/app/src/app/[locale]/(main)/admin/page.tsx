import { createClient } from '@op/api/serverClient';
import { platformAdminEmailDomain } from '@op/core';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const client = await createClient();
  const user = await client.account.getMyAccount();
  const userEmailDomain = user.email.split('@')[1];

  if (userEmailDomain !== platformAdminEmailDomain) {
    notFound();
  }

  return (
    <div className="flex size-full items-center justify-center">
      <p className="text-xl">Coming Soon</p>
    </div>
  );
}
