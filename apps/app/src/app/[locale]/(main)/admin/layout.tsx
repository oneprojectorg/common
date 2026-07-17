import { createClient } from '@op/api/serverClient';
import { isUserEmailPlatformAdmin } from '@op/common';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const client = await createClient();
  const user = await client.account.getMyAccount();

  if (!user?.email || !isUserEmailPlatformAdmin(user.email)) {
    notFound();
  }

  return <div className="flex w-full flex-col gap-8 p-8">{children}</div>;
}
