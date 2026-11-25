import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { logger } from '@op/logging';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { CommonDashboard } from '@/components/screens/CommonDashboard';

import { assertStaffViewer } from '../assertStaffViewer';

interface MetricsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: MetricsPageProps): Promise<Metadata> {
  await assertStaffViewer();
  const { locale } = await params;
  const t = await getTranslations({ namespace: 'commonDashboard', locale });

  return { title: t('pageTitle') };
}

export default async function MetricsPage() {
  await assertStaffViewer();

  // Best effort: on failure the client refetches under its own boundary.
  const { utils, queryClient } = await createServerUtils();
  try {
    await utils.platform.getDashboardMetrics.fetch();
  } catch (error) {
    logger.error('Failed to preload the dashboard metrics', { error });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommonDashboard />
    </HydrationBoundary>
  );
}
