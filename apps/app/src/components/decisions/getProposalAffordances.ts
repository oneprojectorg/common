import { ProposalStatus } from '@op/api/encoders';
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
  /**
   * Decision-admin curation of a submitted proposal: merge, do not advance,
   * hide, delete. Not `proposal.access.admin` — the author is admin of the
   * proposal's own profile.
   */
  moderation: boolean;
}

export const NO_PROPOSAL_AFFORDANCES: ProposalAffordances = {
  review: { feedback: false, revisions: false },
  moderation: false,
};

type ProposalReviewPhase = { phaseId: string } & Parameters<
  typeof isReviewPhase
>[0];

export function getProposalAffordances({
  instance,
  proposal,
  user,
}: {
  instance: Parameters<
    typeof getInstanceCurrentPhase<ProposalReviewPhase>
  >[0] & { access?: { admin?: boolean; review?: boolean } | null };
  proposal: {
    submittedBy?: { id: string } | null;
    status?: string | null;
  };
  user: { currentProfile?: { id: string } | null } | null | undefined;
}): ProposalAffordances {
  const currentProfileId = user?.currentProfile?.id;
  const isDecisionAdmin = instance.access?.admin === true;
  const feedback =
    (!!currentProfileId && proposal.submittedBy?.id === currentProfileId) ||
    isDecisionAdmin ||
    instance.access?.review === true;

  const currentPhase = getInstanceCurrentPhase(instance);

  return {
    review: {
      feedback,
      revisions: !!currentPhase && isReviewPhase(currentPhase) && feedback,
    },
    moderation: isDecisionAdmin && proposal.status !== ProposalStatus.DRAFT,
  };
}
