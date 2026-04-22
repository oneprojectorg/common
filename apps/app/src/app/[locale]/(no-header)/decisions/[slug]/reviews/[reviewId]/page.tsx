import { ReviewLayout } from '@/components/decisions/Review/ReviewLayout';

export default async function ReviewProposalPage({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string }>;
}) {
  const { slug: decisionSlug, reviewId: assignmentId } = await params;

  return (
    <ReviewLayout decisionSlug={decisionSlug} assignmentId={assignmentId} />
  );
}
