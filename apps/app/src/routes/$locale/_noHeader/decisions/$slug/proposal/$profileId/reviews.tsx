import { getProposalReviewsView } from '@/server/decisions.functions';
import { Skeleton } from '@op/sense/Skeleton';
import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { ProposalReviewsLayout } from '@/components/decisions/ProposalReviews/ProposalReviewsLayout';

export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/proposal/$profileId/reviews',
)({
  loader: async ({ params }) => {
    const [t, { decisionName, ...view }] = await Promise.all([
      getTranslations({ locale: params.locale }),
      getProposalReviewsView({
        data: { slug: params.slug, profileId: params.profileId },
      }),
    ]);
    const label = t('decisions.review.reviewsLabel');

    return {
      view,
      title: decisionName ? `${label} | ${decisionName}` : label,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: ProposalReviewsLoading,
  component: ProposalReviewsPage,
});

function ProposalReviewsPage() {
  const { view } = Route.useLoaderData();

  return <ProposalReviewsLayout view={view} />;
}

/**
 * Neutral shell for the proposal-keyed reviews URL. The screen behind this URL
 * differs per viewer (admin summary vs. reviewer split pane), so the pending
 * state commits to no shape below the navbar.
 */
function ProposalReviewsLoading() {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-6 md:px-8">
        <Skeleton className="h-5 w-36" />
      </div>
    </div>
  );
}
