import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OrgsTable } from '@/components/screens/PlatformAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: `${t('Organizations')} | ${t('Admin')}` };
}

export default function AdminOrgsPage() {
  return <OrgsTable />;
}
