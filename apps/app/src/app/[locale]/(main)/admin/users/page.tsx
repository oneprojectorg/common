import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { UsersTable } from '@/components/screens/PlatformAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: `${t('Users')} | ${t('Admin')}` };
}

export default function AdminUsersPage() {
  return <UsersTable />;
}
