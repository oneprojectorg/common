import { ReviewSummaryLayout } from '@/components/decisions/ReviewSummary/ReviewSummaryLayout';

export default async function ReviewSummaryPage({
  params,
}: {
  params: Promise<{ slug: string; proposalId: string }>;
}) {
  const { slug, proposalId } = await params;

  return <ReviewSummaryLayout decisionSlug={slug} proposalId={proposalId} />;
}
