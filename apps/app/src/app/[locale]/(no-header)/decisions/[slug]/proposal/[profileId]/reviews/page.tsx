import { ReviewSummaryLayout } from '@/components/decisions/ReviewSummary/ReviewSummaryLayout';

export default async function ReviewSummaryPage({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) {
  const { slug, profileId: proposalProfileId } = await params;

  return (
    <ReviewSummaryLayout
      decisionSlug={slug}
      proposalProfileId={proposalProfileId}
    />
  );
}
