import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { ProcessAdminOverview } from '@/components/decisions/ProcessAdmin/ProcessAdminOverview';
import { hasFirstPhaseStarted } from '@/components/decisions/hasFirstPhaseStarted';

import { loadProcessAdmin } from '../loadProcessAdmin';

interface ManageDecisionPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: ManageDecisionPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const [{ decisionProfile }, t] = await Promise.all([
    loadProcessAdmin(slug),
    getTranslations({ locale, namespace: 'decisions.processAdmin' }),
  ]);

  return { title: t('pageTitle', { decisionName: decisionProfile.name }) };
}

const ManageDecisionPage = async ({ params }: ManageDecisionPageProps) => {
  const { slug } = await params;
  const { decisionProfile } = await loadProcessAdmin(slug);

  // Seed the cache with the gate's read so the overview renders without
  // suspending. The client still refetches it in the background once stale.
  const { utils, queryClient } = await createServerUtils();
  queryClient.setQueryData(
    utils.decision.getDecisionBySlug.queryOptions({ slug }).queryKey,
    decisionProfile,
  );

  // A process with no phases has not started, whatever its dates say.
  const phases = decisionProfile.processInstance.instanceData.phases ?? [];
  const hasStarted = phases.length > 0 && hasFirstPhaseStarted(phases);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProcessAdminOverview slug={slug} hasStarted={hasStarted} />
    </HydrationBoundary>
  );
};

export default ManageDecisionPage;
