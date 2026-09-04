import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { DecisionsTable } from '@/components/screens/PlatformAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: `${t('Decisions')} | ${t('Admin')}` };
}

export default function AdminDecisionsPage() {
  return <DecisionsTable />;
}
