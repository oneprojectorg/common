import { createClient } from '@op/api/serverClient';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const client = await createClient();
  const user = await client.account.getMyAccount();

  // 404, not 403: the admin area isn't advertised to anyone who can't use it.
  if (!user?.isPlatformAdmin) {
    notFound();
  }

  return <div className="flex w-full flex-col gap-8 p-8">{children}</div>;
}
