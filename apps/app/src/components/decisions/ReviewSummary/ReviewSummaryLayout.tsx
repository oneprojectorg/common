import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';

import { ReviewSummaryView } from './ReviewSummaryView';

interface ReviewSummaryLayoutProps {
  decisionSlug: string;
  proposalId: string;
}

export async function ReviewSummaryLayout({
  decisionSlug,
  proposalId,
}: ReviewSummaryLayoutProps) {
  const client = await createClient();

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({
      slug: decisionSlug,
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 403) {
      forbidden();
    }
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  if (!decisionProfile.processInstance.access?.admin) {
    forbidden();
  }

  const instanceId = decisionProfile.processInstance.id;

  const { utils, queryClient } = await createServerUtils();

  // Sequential: need proposal.profileId before we can prefetch getProposal.
  const aggregates = await utils.decision.getWithReviewAggregates.fetch({
    processInstanceId: instanceId,
    proposalId,
  });

  const profileId = aggregates.proposal.profileId;

  await Promise.all([
    utils.decision.getInstance.prefetch({ instanceId }),
    utils.decision.getProposal.prefetch({ profileId }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewSummaryView
        decisionSlug={decisionSlug}
        instanceId={instanceId}
        proposalId={proposalId}
        profileId={profileId}
      />
    </HydrationBoundary>
  );
}
