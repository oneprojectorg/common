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
  proposalProfileId: string;
}

export async function ReviewSummaryLayout({
  decisionSlug,
  proposalProfileId,
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

  const [proposal, instance] = await Promise.all([
    (async () => {
      try {
        return await utils.decision.getProposal.fetch({
          profileId: proposalProfileId,
        });
      } catch (error) {
        const cause = error instanceof Error ? error.cause : null;
        if (cause instanceof CommonError && cause.statusCode === 404) {
          notFound();
        }
        throw error;
      }
    })(),
    utils.decision.getInstance.fetch({ instanceId }),
  ]);

  if (proposal.processInstanceId !== instanceId) {
    notFound();
  }

  const proposalId = proposal.id;
  const phaseId = resolveReviewPhaseId(instance);

  await utils.decision.getProposalWithReviewAggregates.prefetch({
    processInstanceId: instanceId,
    proposalId,
    phaseId,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewSummaryView
        decisionSlug={decisionSlug}
        instanceId={instanceId}
        proposalId={proposalId}
        proposalProfileId={proposalProfileId}
        phaseId={phaseId}
      />
    </HydrationBoundary>
  );
}

// Walk back from the current phase to find the most recent review phase —
// after a review phase ends, currentStateId no longer points at it but the
// review assignments are still pinned to the original review phase id.
function resolveReviewPhaseId(instance: {
  currentStateId: string | null;
  instanceData?: {
    phases?: Array<{
      phaseId: string;
      rules?: { proposals?: { review?: boolean } };
    }>;
  } | null;
}): string | undefined {
  const phases = instance.instanceData?.phases ?? [];
  const currentIdx = phases.findIndex(
    (p) => p.phaseId === instance.currentStateId,
  );
  const startIdx = currentIdx === -1 ? phases.length - 1 : currentIdx;
  for (let i = startIdx; i >= 0; i--) {
    const phase = phases[i];
    if (phase?.rules?.proposals?.review === true) {
      return phase.phaseId;
    }
  }
  return instance.currentStateId ?? undefined;
}
