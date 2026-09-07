import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { DecisionInstanceDetail } from '@/components/screens/PlatformAdmin';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: `${t('Decision')} | ${t('Admin')}` };
}

export default async function AdminDecisionInstancePage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  return <DecisionInstanceDetail instanceId={instanceId} />;
}
