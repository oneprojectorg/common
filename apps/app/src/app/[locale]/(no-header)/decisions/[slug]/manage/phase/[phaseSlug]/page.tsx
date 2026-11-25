import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getTranslations } from '@/lib/i18n';

import { ProcessAdminPhasePage } from '@/components/decisions/ProcessAdmin/ProcessAdminPhasePage';

import { loadProcessAdmin } from '../../../loadProcessAdmin';

interface ManagePhasePageProps {
  params: Promise<{ slug: string; phaseId: string; locale: string }>;
}

const loadPhase = async ({
  slug,
  phaseId,
}: {
  slug: string;
  phaseId: string;
}) => {
  const { decisionProfile } = await loadProcessAdmin(slug);
  const phase = decisionProfile.processInstance.phases.find(
    (candidate) => candidate.slug === phaseId,
  );

  if (!phase) {
    notFound();
  }

  return { decisionProfile, phase };
};

export async function generateMetadata({
  params,
}: ManagePhasePageProps): Promise<Metadata> {
  const { slug, phaseId, locale } = await params;
  const [{ decisionProfile, phase }, t] = await Promise.all([
    loadPhase({ slug, phaseId }),
    getTranslations({ locale, namespace: 'decisions.processAdmin' }),
  ]);

  return {
    title: t('phasePageTitle', {
      phaseName: phase.name ?? '',
      decisionName: decisionProfile.name,
    }),
  };
}

const ManagePhasePage = async ({ params }: ManagePhasePageProps) => {
  const { slug, phaseId } = await params;
  const { decisionProfile } = await loadPhase({ slug, phaseId });

  const { utils, queryClient } = await createServerUtils();
  queryClient.setQueryData(
    utils.decision.getDecisionBySlug.queryOptions({ slug }).queryKey,
    decisionProfile,
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProcessAdminPhasePage slug={slug} phaseSlug={phaseId} />
    </HydrationBoundary>
  );
};

export default ManagePhasePage;
