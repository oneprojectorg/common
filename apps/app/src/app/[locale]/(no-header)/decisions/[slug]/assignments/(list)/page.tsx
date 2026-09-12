import { HydrationBoundary, createServerTRPC, dehydrate } from '@op/api/server';
import { nextCursor } from '@op/common/client';
import { logger } from '@op/logging';
import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { AssignmentsPageShell } from '@/components/decisions/ReviewAssignments/AssignmentsPageShell';
import { ReviewersTableSection } from '@/components/decisions/ReviewAssignments/ReviewersTableSection';

import { loadReviewAssignmentsPage } from '../loadReviewAssignmentsPage';

interface ReviewAssignmentsPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

// Tab title only — the page is admin-only, so no crawlable metadata is needed.
export async function generateMetadata({
  params,
}: ReviewAssignmentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return { title: t('Review assignments') };
}

/** The reviewers table — admin only. */
export default async function ReviewAssignmentsPage({
  params,
}: ReviewAssignmentsPageProps) {
  const { slug } = await params;
  const [t, { processInstanceId, phaseId }] = await Promise.all([
    getTranslations(),
    loadReviewAssignmentsPage(slug),
  ]);

  // Best effort: on failure the client refetches under its own boundary.
  const { trpc, queryClient } = await createServerTRPC();
  try {
    await queryClient.fetchInfiniteQuery(
      trpc.decision.listPhaseReviewerSummaries.infiniteQueryOptions(
        { processInstanceId, phaseId },
        { getNextPageParam: nextCursor },
      ),
    );
  } catch (error) {
    logger.warn('Failed to preload phase review assignments', {
      processInstanceId,
      phaseId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <AssignmentsPageShell
      backHref={`/decisions/${slug}/current?tab=assignments`}
    >
      <Header1 className="text-headline">{t('Review assignments')}</Header1>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ReviewersTableSection
          decisionSlug={slug}
          processInstanceId={processInstanceId}
          phaseId={phaseId}
        />
      </HydrationBoundary>
    </AssignmentsPageShell>
  );
}
