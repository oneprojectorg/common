import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { logger } from '@op/logging';
import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { TranslatedText } from '@/components/TranslatedText';
import { AssignmentsPageShell } from '@/components/decisions/ReviewAssignments/AssignmentsPageShell';
import { ReviewersTableSection } from '@/components/decisions/ReviewAssignments/ReviewersTableSection';

import { loadReviewAssignmentsPage } from './loadReviewAssignmentsPage';

interface ReviewAssignmentsPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: ReviewAssignmentsPageProps): Promise<Metadata> {
  const { slug, locale } = await params;

  const [{ decisionName }, t] = await Promise.all([
    loadReviewAssignmentsPage(slug),
    getTranslations({ locale }),
  ]);

  const title = t('Review assignments');

  return { title: decisionName ? `${title} | ${decisionName}` : title };
}

/** The reviewers table — admin only, behind `manual_review_assignments`. */
export default async function ReviewAssignmentsPage({
  params,
}: ReviewAssignmentsPageProps) {
  const { slug } = await params;
  const { processInstanceId, phaseId } = await loadReviewAssignmentsPage(slug);

  // Best effort: on failure the client refetches under its own boundary.
  const { utils, queryClient } = await createServerUtils();
  try {
    await utils.decision.listPhaseReviewAssignments.fetch({
      processInstanceId,
      phaseId,
    });
  } catch (error) {
    logger.warn('Failed to seed phase review assignments', {
      processInstanceId,
      phaseId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <AssignmentsPageShell backHref={`/decisions/${slug}`}>
      <Header1 className="text-headline">
        <TranslatedText text="Review assignments" />
      </Header1>

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
