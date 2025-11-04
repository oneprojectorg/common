import { createClient } from '@op/api/serverClient';
import { superAdminEmails } from '@op/core';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PlatformAdminLayout = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const client = await createClient();
  const user = await client.account.getMyAccount();

  if (!user || !superAdminEmails.includes(user.email)) {
    notFound();
  }

  return <div className="flex size-full flex-col">{children}</div>;
};

export default PlatformAdminLayout;
