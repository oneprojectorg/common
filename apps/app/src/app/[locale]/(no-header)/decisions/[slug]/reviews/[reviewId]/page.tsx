import { ReviewLayoutClient } from '@/components/decisions/Review/ReviewLayoutClient';

export default async function ReviewProposalPage({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string }>;
}) {
  const { slug, reviewId: assignmentId } = await params;

  return <ReviewLayoutClient decisionSlug={slug} assignmentId={assignmentId} />;
}
