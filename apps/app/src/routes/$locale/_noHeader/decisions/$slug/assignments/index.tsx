import { prefetchReviewAssignments } from '@/server/decisions.functions';
import { parseDehydratedState } from '@op/api/dehydratedState';
import { Header1 } from '@op/sense/Header';
import { HydrationBoundary } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { pageTitle } from '@/lib/head';
import { getTranslations, useTranslations } from '@/lib/i18n';

import { AssignmentsPageShell } from '@/components/decisions/ReviewAssignments/AssignmentsPageShell';
import { ReviewAssignmentsPageSkeleton } from '@/components/decisions/ReviewAssignments/ReviewAssignmentsSkeletons';
import { ReviewersTableSection } from '@/components/decisions/ReviewAssignments/ReviewersTableSection';

/** The reviewers table — admin only. */
export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/assignments/',
)({
  loader: async ({ params }) => {
    const [t, assignments] = await Promise.all([
      getTranslations({ namespace: 'decisions', locale: params.locale }),
      prefetchReviewAssignments({ data: { slug: params.slug } }),
    ]);

    return { ...assignments, title: t('reviewAssignmentsPageTitle') };
  },
  // Tab title only — the page is admin-only, so no crawlable metadata is needed.
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: ReviewAssignmentsPageSkeleton,
  component: ReviewAssignmentsPage,
});

function ReviewAssignmentsPage() {
  const t = useTranslations('decisions');
  const { slug } = Route.useParams();
  const { processInstanceId, phaseId, dehydratedState } = Route.useLoaderData();
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

  return (
    <AssignmentsPageShell
      backHref={`/decisions/${slug}/current?tab=assignments`}
    >
      <Header1 className="text-headline">
        {t('reviewAssignmentsPageTitle')}
      </Header1>

      <HydrationBoundary state={hydrationState}>
        <ReviewersTableSection
          decisionSlug={slug}
          processInstanceId={processInstanceId}
          phaseId={phaseId}
        />
      </HydrationBoundary>
    </AssignmentsPageShell>
  );
}
