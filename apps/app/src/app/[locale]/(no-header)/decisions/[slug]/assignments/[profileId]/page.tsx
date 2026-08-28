import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { logger } from '@op/logging';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AssignmentsPageShell } from '@/components/decisions/ReviewAssignments/AssignmentsPageShell';
import { ManageAssignmentsAction } from '@/components/decisions/ReviewAssignments/ManageAssignmentsAction';
import { ReviewerAssignmentsSection } from '@/components/decisions/ReviewAssignments/ReviewerAssignmentsSection';
import { ReviewerHeader } from '@/components/decisions/ReviewAssignments/ReviewerHeader';
import { buildReviewerRows } from '@/components/decisions/ReviewAssignments/buildReviewerRows';

import { loadReviewAssignmentsPage } from '../loadReviewAssignmentsPage';

interface ReviewerAssignmentsPageProps {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}

interface ServerReviewer {
  name: string;
  email: string | null;
}

// Tab title only — the page is admin-only, so no crawlable metadata is needed.
export async function generateMetadata({
  params,
}: ReviewerAssignmentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return { title: t('Review assignments') };
}

/** One reviewer's assignments — admin only, behind `manual_review_assignments`. */
export default async function ReviewerAssignmentsPage({
  params,
}: ReviewerAssignmentsPageProps) {
  const { slug, profileId } = await params;
  const { processInstanceId, phaseId } = await loadReviewAssignmentsPage(slug);

  const { utils, queryClient } = await createServerUtils();
  const reviewer = await seedReviewer(utils, {
    processInstanceId,
    phaseId,
    profileId,
  });

  return (
    <AssignmentsPageShell
      backHref={`/decisions/${slug}/assignments`}
      action={
        <HydrationBoundary state={dehydrate(queryClient)}>
          <ManageAssignmentsAction
            processInstanceId={processInstanceId}
            phaseId={phaseId}
            reviewerProfileId={profileId}
          />
        </HydrationBoundary>
      }
    >
      {reviewer ? (
        <ReviewerHeader name={reviewer.name} email={reviewer.email} />
      ) : null}

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ReviewerAssignmentsSection
          processInstanceId={processInstanceId}
          phaseId={phaseId}
          reviewerProfileId={profileId}
          hasServerRenderedHeader={reviewer !== null}
        />
      </HydrationBoundary>
    </AssignmentsPageShell>
  );
}

/** Seeds the query cache and resolves the reviewer. Best effort — the client recovers. */
async function seedReviewer(
  utils: Awaited<ReturnType<typeof createServerUtils>>['utils'],
  {
    processInstanceId,
    phaseId,
    profileId,
  }: { processInstanceId: string; phaseId: string; profileId: string },
): Promise<ServerReviewer | null> {
  try {
    const data = await utils.decision.listPhaseReviewAssignments.fetch({
      processInstanceId,
      phaseId,
    });
    const { rows } = buildReviewerRows(
      data.reviewers,
      data.eligibleReviewers,
      data.proposals,
    );
    const row = rows.find((candidate) => candidate.profile.id === profileId);

    return row ? { name: row.label, email: row.email } : null;
  } catch (error) {
    logger.warn('Failed to seed phase review assignments', {
      processInstanceId,
      phaseId,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}
