import {
  areCommentsAllowed,
  getInstanceCurrentPhase,
  isReviewPhase,
} from '@op/common/client';

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
  comments: {
    /**
     * The process's "Allow comments" toggle. Off removes the whole comments
     * surface — the section, the composer, and the links that jump to it —
     * rather than just the composer, which is what the logged-out gate does.
     */
    enabled: boolean;
  };
}

/**
 * Nothing on offer — except comments, which stay enabled because that is the
 * process default (`areCommentsAllowed`), not a grant. Its only user is the
 * legacy proposal route, whose instances predate the toggle; see the note
 * there. The server refuses the write regardless.
 */
export const NO_PROPOSAL_AFFORDANCES: ProposalAffordances = {
  review: { feedback: false, revisions: false },
  comments: { enabled: true },
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
  proposal: { submittedBy?: { id: string } | null };
  user: { currentProfile?: { id: string } | null } | null | undefined;
}): ProposalAffordances {
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
    comments: { enabled: areCommentsAllowed(instance.instanceData) },
  };
}
