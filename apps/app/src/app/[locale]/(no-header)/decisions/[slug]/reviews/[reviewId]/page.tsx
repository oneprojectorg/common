import { ReviewExploreLayout } from '@/components/decisions/ReviewExplore/ReviewExploreLayout';

const ReviewProposalPage = async ({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string }>;
}) => {
  const { slug, reviewId } = await params;

  return <ReviewExploreLayout slug={slug} reviewId={reviewId} />;
};

export default ReviewProposalPage;
