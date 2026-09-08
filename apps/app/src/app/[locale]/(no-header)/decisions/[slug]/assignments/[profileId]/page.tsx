import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { logger } from '@op/logging';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getTranslations } from '@/lib/i18n';

import { AssignmentsPageShell } from '@/components/decisions/ReviewAssignments/AssignmentsPageShell';
import { ManageAssignmentsAction } from '@/components/decisions/ReviewAssignments/ManageAssignmentsAction';
import { ReviewerAssignmentsSection } from '@/components/decisions/ReviewAssignments/ReviewerAssignmentsSection';

import { loadReviewAssignmentsPage } from '../loadReviewAssignmentsPage';

interface ReviewerAssignmentsPageProps {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: ReviewerAssignmentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return { title: t('Review assignments') };
}

export default async function ReviewerAssignmentsPage({
  params,
}: ReviewerAssignmentsPageProps) {
  const { slug, profileId } = await params;

  const { processInstanceId, phaseId, access } =
    await loadReviewAssignmentsPage(slug);

  // The SSR render has no browser client, so the suspending input needs a seed.
  const { utils, queryClient } = await createServerUtils();
  const preloaded = await utils.decision.listReviewerAssignments
    .fetchInfinite({ processInstanceId, phaseId, reviewerProfileId: profileId })
    .catch((error: unknown) => {
      logger.warn('Failed to preload reviewer assignments', {
        processInstanceId,
        phaseId,
        reviewerProfileId: profileId,
        error,
      });

      return null;
    });

  if (preloaded && !preloaded.pages[0]?.reviewer) {
    notFound();
  }

  return (
    <AssignmentsPageShell
      backHref={`/decisions/${slug}/current?tab=assignments`}
      action={
        <ManageAssignmentsAction
          processInstanceId={processInstanceId}
          phaseId={phaseId}
          reviewerProfileId={profileId}
        />
      }
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ReviewerAssignmentsSection
          processInstanceId={processInstanceId}
          phaseId={phaseId}
          reviewerProfileId={profileId}
          decisionSlug={slug}
          access={access}
        />
      </HydrationBoundary>
    </AssignmentsPageShell>
  );
}
