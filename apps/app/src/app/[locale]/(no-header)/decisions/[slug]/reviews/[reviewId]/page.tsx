import { ReviewExploreLayout } from '@/components/decisions/ReviewExplore/ReviewExploreLayout';

export default async function ReviewProposalPage({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string }>;
}) {
  const { slug, reviewId } = await params;

  return <ReviewExploreLayout slug={slug} reviewId={reviewId} />;
}
