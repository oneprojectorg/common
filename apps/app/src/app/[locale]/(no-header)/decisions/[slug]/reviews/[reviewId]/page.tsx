import { ReviewLayout } from '@/components/decisions/Review/ReviewLayout';

export default async function ReviewProposalPage({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string }>;
}) {
  const { slug, reviewId } = await params;

  return <ReviewLayout decisionSlug={slug} reviewId={reviewId} />;
}
