import { getReviewView } from '@/server/decisions.functions';
import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { ReviewLayout } from '@/components/decisions/Review/ReviewLayout';
import { ReviewSkeleton } from '@/components/decisions/Review/ReviewSkeleton';

export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/reviews/$reviewId',
)({
  loader: async ({ params }) => {
    const [t, { reviewedProposal, decisionName, ...review }] =
      await Promise.all([
        getTranslations({ locale: params.locale }),
        getReviewView({
          data: { slug: params.slug, assignmentId: params.reviewId },
        }),
      ]);

    if (!reviewedProposal) {
      return { review, title: null };
    }

    const reviewLabel = t('decisions.reviewPageTitle', {
      title: reviewedProposal.name || t('decisions.proposals.untitledProposal'),
    });

    return {
      review,
      title: decisionName ? `${reviewLabel} | ${decisionName}` : reviewLabel,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: ReviewSkeleton,
  component: ReviewProposalPage,
});

function ReviewProposalPage() {
  const { review } = Route.useLoaderData();

  return <ReviewLayout {...review} />;
}
