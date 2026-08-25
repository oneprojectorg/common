import { isReviewPhase } from '@op/common/client';

/**
 * Which reviewer-authored artifacts a viewer may see on a proposal — named by
 * capability rather than by the panel that happens to render them, and shared
 * by the view and edit routes so the rules live in one place.
 *
 * UX gating only: every underlying query is still asserted server-side, so a
 * `true` here never grants anything — it only keeps queries off surfaces that
 * would be denied anyway, and keeps the toggles that open them hidden. Plain
 * booleans so the object crosses the RSC boundary and reads well in Storybook.
 */
export interface ProposalReviewVisibility {
  /**
   * Author, decision admin, or explicit review access — with no phase
   * condition. Which notes are actually released stays a server decision (only
   * ended review phases), so there is no client phase math here.
   */
  feedback: boolean;
  /**
   * The revision panes are a mid-phase affordance; the feedback panel carries
   * the history once the phase has ended.
   */
  revisions: boolean;
}

/** Legacy instances and any other caller with no instance to derive from. */
export const NO_PROPOSAL_REVIEW_VISIBILITY: ProposalReviewVisibility = {
  feedback: false,
  revisions: false,
};

/**
 * Typed structurally so both the API-encoder shapes and the domain types pass —
 * same reason `phaseSettings.ts` does. `rules` is borrowed from `isReviewPhase`
 * so the phase-rules shape stays in one place.
 */
type ProposalReviewPhase = { phaseId: string } & Parameters<
  typeof isReviewPhase
>[0];

export function getProposalReviewVisibility({
  instance,
  proposal,
  user,
}: {
  instance: {
    currentStateId?: string | null;
    instanceData?: { phases?: readonly ProposalReviewPhase[] } | null;
    access?: { admin?: boolean; review?: boolean } | null;
  };
  proposal: { submittedBy?: { id: string } | null };
  user: { currentProfile?: { id: string } | null } | null | undefined;
}): ProposalReviewVisibility {
  const currentProfileId = user?.currentProfile?.id;
  const isAuthor =
    !!currentProfileId && proposal.submittedBy?.id === currentProfileId;
  const feedback =
    isAuthor ||
    instance.access?.admin === true ||
    instance.access?.review === true;

  const currentPhase = instance.instanceData?.phases?.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const isInReviewPhase = !!currentPhase && isReviewPhase(currentPhase);

  return { feedback, revisions: isInReviewPhase && feedback };
}
