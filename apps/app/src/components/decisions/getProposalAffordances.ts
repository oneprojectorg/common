import { getInstanceCurrentPhase, isReviewPhase } from '@op/common/client';

/**
 * What the UI offers a viewer on a proposal, grouped by feature so later ones
 * add a sibling to `review` rather than a prefix. UX gating only — every query
 * behind these bits is still asserted server-side, so a `true` never grants
 * anything.
 */
export interface ProposalAffordances {
  review: {
    feedback: boolean;
    /** Mid-phase only; the feedback panel carries the history afterwards. */
    revisions: boolean;
  };
}

export const NO_PROPOSAL_AFFORDANCES: ProposalAffordances = {
  review: { feedback: false, revisions: false },
};

type ProposalReviewPhase = { phaseId: string } & Parameters<
  typeof isReviewPhase
>[0];

/**
 * Author standing comes from `proposal.access.update`, not from a
 * `submittedBy` comparison: `getPermissionsOnProposal` resolves that bit from
 * roles on the proposal's own profile, so it covers every co-author (creator
 * and invitee) and not just the submitting profile. It is false for instance
 * admins and reviewers, which is why the two instance branches stay.
 */
export function getProposalAffordances({
  instance,
  proposal,
}: {
  instance: Parameters<
    typeof getInstanceCurrentPhase<ProposalReviewPhase>
  >[0] & { access?: { admin?: boolean; review?: boolean } | null };
  proposal: { access?: { update?: boolean } | null };
}): ProposalAffordances {
  const feedback =
    proposal.access?.update === true ||
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
