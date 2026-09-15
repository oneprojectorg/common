import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { UserDetail } from '@/components/screens/PlatformAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: `${t('User')} | ${t('Admin')}` };
}

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ authUserId: string }>;
}) {
  const { authUserId } = await params;
  return <UserDetail authUserId={authUserId} />;
}
