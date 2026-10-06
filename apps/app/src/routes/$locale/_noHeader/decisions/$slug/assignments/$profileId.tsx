import { prefetchReviewerAssignments } from '@/server/decisions.functions';
import { parseDehydratedState } from '@op/api/dehydratedState';
import { HydrationBoundary } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { AssignmentsPageShell } from '@/components/decisions/ReviewAssignments/AssignmentsPageShell';
import { ManageAssignmentsAction } from '@/components/decisions/ReviewAssignments/ManageAssignmentsAction';
import { ReviewerAssignmentsPageSkeleton } from '@/components/decisions/ReviewAssignments/ReviewAssignmentsSkeletons';
import { ReviewerAssignmentsSection } from '@/components/decisions/ReviewAssignments/ReviewerAssignmentsSection';

/** One reviewer's assignments — admin only. */
export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/assignments/$profileId',
)({
  loader: async ({ params }) => {
    const [t, assignments] = await Promise.all([
      getTranslations({ namespace: 'decisions', locale: params.locale }),
      prefetchReviewerAssignments({
        data: { slug: params.slug, profileId: params.profileId },
      }),
    ]);

    return { ...assignments, title: t('reviewAssignmentsPageTitle') };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: ReviewerAssignmentsPageSkeleton,
  component: ReviewerAssignmentsPage,
});

function ReviewerAssignmentsPage() {
  const { slug, profileId } = Route.useParams();
  const { processInstanceId, phaseId, access, dehydratedState } =
    Route.useLoaderData();
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

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
      <HydrationBoundary state={hydrationState}>
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
