import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { logger } from '@op/logging';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { getTranslations } from '@/lib/i18n';

import { AssignmentsPageShell } from '@/components/decisions/ReviewAssignments/AssignmentsPageShell';
import { ManageAssignmentsAction } from '@/components/decisions/ReviewAssignments/ManageAssignmentsAction';
import { ReviewerAssignmentsSection } from '@/components/decisions/ReviewAssignments/ReviewerAssignmentsSection';

import { loadReviewAssignmentsPage } from '../loadReviewAssignmentsPage';

interface ReviewerAssignmentsPageProps {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}

// Tab title only — the page is admin-only, so no crawlable metadata is needed.
export async function generateMetadata({
  params,
}: ReviewerAssignmentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return { title: t('Review assignments') };
}

/** One reviewer's assignments — admin only. */
export default async function ReviewerAssignmentsPage({
  params,
}: ReviewerAssignmentsPageProps) {
  const { slug, profileId } = await params;

  // The router rejects a non-uuid `reviewerProfileId` with a 400, which would
  // otherwise surface as a "couldn't load" error state for what is just a bad
  // link. Check the shape before anything is fetched.
  if (!z.uuid().safeParse(profileId).success) {
    notFound();
  }

  const { processInstanceId, phaseId, access } =
    await loadReviewAssignmentsPage(slug);

  // The section suspends on this input, so it must be seeded here: without a
  // hydrated entry the SSR render reaches for the browser client's relative URL.
  // The service returns `reviewer: null` for a profile with no tie to this
  // process, and that is a dead link, so the page 404s on it.
  const { utils, queryClient } = await createServerUtils();
  const preloaded = await preloadReviewerAssignments(utils, {
    processInstanceId,
    phaseId,
    reviewerProfileId: profileId,
  });

  // Outside the preload's try/catch: `notFound()` throws, and a catch there
  // would swallow it into the keep-rendering path.
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

/**
 * Seeds the first page and hands it back so the caller can inspect it. Returns
 * null when the fetch fails: the client section recovers on its own, so a
 * failure must not stop the page from rendering.
 */
async function preloadReviewerAssignments(
  utils: Awaited<ReturnType<typeof createServerUtils>>['utils'],
  input: {
    processInstanceId: string;
    phaseId: string;
    reviewerProfileId: string;
  },
) {
  try {
    return await utils.decision.listReviewerAssignments.fetchInfinite(input);
  } catch (error) {
    logger.warn('Failed to preload reviewer assignments', {
      processInstanceId: input.processInstanceId,
      phaseId: input.phaseId,
      reviewerProfileId: input.reviewerProfileId,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}
