import { createClient } from '@op/api/serverClient';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ProposalReviewsLayout } from '@/components/decisions/ProposalReviews/ProposalReviewsLayout';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;

  try {
    const [client, t] = await Promise.all([
      createClient(),
      getTranslations({ locale }),
    ]);
    const decisionProfile = await client.decision.getDecisionBySlug({ slug });
    const label = t('Reviews');
    return {
      title: decisionProfile?.name
        ? `${label} | ${decisionProfile.name}`
        : label,
    };
  } catch {
    return {};
  }
}

export default async function ProposalReviewsPage({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) {
  const { slug, profileId: proposalProfileId } = await params;

  return (
    <ProposalReviewsLayout
      decisionSlug={slug}
      proposalProfileId={proposalProfileId}
    />
  );
}
