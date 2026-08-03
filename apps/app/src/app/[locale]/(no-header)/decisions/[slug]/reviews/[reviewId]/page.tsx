import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { forbidden, notFound } from 'next/navigation';

import { ReviewLayout } from '@/components/decisions/Review/ReviewLayout';

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
      reviewedProposal.profile?.name || t('Untitled Proposal');

    const reviewLabel = t('Review {title}', { title: proposalTitle });
    const decisionName = decisionProfile?.name;
    return {
      title: decisionName ? `${reviewLabel} | ${decisionName}` : reviewLabel,
    };
  } catch (error) {
    // Auth failures become the same interrupts ReviewLayout uses; anything
    // else falls through to empty metadata and lets the page render decide.
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError) {
      if (cause.statusCode === 401 || cause.statusCode === 403) {
        forbidden();
      }
      if (cause.statusCode === 404) {
        notFound();
      }
    }
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
