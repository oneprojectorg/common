import { isolateBidi } from '@/utils/isolateBidi';
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
  params: Promise<{ slug: string; phaseSlug: string; locale: string }>;
}

const loadPhase = async ({
  slug,
  phaseSlug,
}: {
  slug: string;
  phaseSlug: string;
}) => {
  const { decisionProfile } = await loadProcessAdmin(slug);
  const phase = decisionProfile.processInstance.phases.find(
    (candidate) => candidate.slug === phaseSlug,
  );

  if (!phase) {
    notFound();
  }

  return { decisionProfile, phase };
};

export async function generateMetadata({
  params,
}: ManagePhasePageProps): Promise<Metadata> {
  const { slug, phaseSlug, locale } = await params;
  const [{ decisionProfile, phase }, t] = await Promise.all([
    loadPhase({ slug, phaseSlug }),
    getTranslations({ locale, namespace: 'decisions.processAdmin' }),
  ]);

  return {
    title: t('phasePageTitle', {
      phaseName: isolateBidi(phase.name ?? ''),
      decisionName: isolateBidi(decisionProfile.name),
    }),
  };
}

const ManagePhasePage = async ({ params }: ManagePhasePageProps) => {
  const { slug, phaseSlug } = await params;
  const { decisionProfile } = await loadPhase({ slug, phaseSlug });

  const { utils, queryClient } = await createServerUtils();
  queryClient.setQueryData(
    utils.decision.getDecisionBySlug.queryOptions({ slug }).queryKey,
    decisionProfile,
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProcessAdminPhasePage slug={slug} phaseSlug={phaseSlug} />
    </HydrationBoundary>
  );
};

export default ManagePhasePage;
