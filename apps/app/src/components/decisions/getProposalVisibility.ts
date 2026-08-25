import { getInstanceCurrentPhase, isReviewPhase } from '@op/common/client';

/**
 * What a viewer may see on a proposal, grouped by feature so later ones add a
 * sibling to `review` rather than a prefix. UX gating only — every query behind
 * these bits is still asserted server-side, so a `true` never grants anything.
 */
export interface ProposalVisibility {
  review: {
    feedback: boolean;
    /** Mid-phase affordance; the feedback panel carries the history afterwards. */
    revisions: boolean;
  };
}

export const NO_PROPOSAL_VISIBILITY: ProposalVisibility = {
  review: { feedback: false, revisions: false },
};

type ProposalReviewPhase = { phaseId: string } & Parameters<
  typeof isReviewPhase
>[0];

export function getProposalVisibility({
  instance,
  proposal,
  user,
}: {
  instance: Parameters<
    typeof getInstanceCurrentPhase<ProposalReviewPhase>
  >[0] & { access?: { admin?: boolean; review?: boolean } | null };
  proposal: { submittedBy?: { id: string } | null };
  user: { currentProfile?: { id: string } | null } | null | undefined;
}): ProposalVisibility {
  const currentProfileId = user?.currentProfile?.id;
  const feedback =
    (!!currentProfileId && proposal.submittedBy?.id === currentProfileId) ||
    instance.access?.admin === true ||
    instance.access?.review === true;

  const currentPhase = getInstanceCurrentPhase(instance);

  return {
    review: {
      feedback,
      revisions: !!currentPhase && isReviewPhase(currentPhase) && feedback,
    },
  };
}
