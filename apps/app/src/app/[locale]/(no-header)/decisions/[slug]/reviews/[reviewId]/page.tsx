import { createClient } from '@op/api/serverClient';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ReviewLayout } from '@/components/decisions/Review/ReviewLayout';
import { getProposalDisplayTitle } from '@/components/decisions/proposalContentUtils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, reviewId, locale } = await params;

  try {
    const [client, t] = await Promise.all([
      createClient(),
      getTranslations({ locale }),
    ]);
    const [assignment, decisionProfile] = await Promise.all([
      client.decision.getReviewAssignment({ assignmentId: reviewId }),
      client.decision.getDecisionBySlug({ slug }),
    ]);

    const reviewedProposal = assignment?.assignment?.proposal;
    if (!reviewedProposal) {
      return {};
    }
    const proposalTitle =
      getProposalDisplayTitle(reviewedProposal) || t('Untitled Proposal');

    const reviewLabel = t('Review {title}', { title: proposalTitle });
    const decisionName = decisionProfile?.name;
    return {
      title: decisionName ? `${reviewLabel} | ${decisionName}` : reviewLabel,
    };
  } catch {
    return {};
  }
}

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
