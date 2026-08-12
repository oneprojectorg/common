'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import type { DecisionAccess } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';

/**
 * Whether the viewer's access on a decision admits Like/Follow.
 *
 * Mirrors the server's OR: `assertPostWriteAccess` admits `{ profile: ADMIN }`
 * or `{ decisions: SUBMIT_PROPOSALS }`, so an admin without an explicit
 * submitter role can still engage. Both the browse card and the proposal page
 * read this — the two gates drifted before, and the page hid controls the API
 * would have accepted.
 */
export const canEngageWithProposals = (
  access?: Pick<DecisionAccess, 'admin' | 'submitProposals'> | null,
) => access?.submitProposals === true || access?.admin === true;

/** Like/follow state and handlers for a proposal's engagement controls. */
export interface ProposalEngagement {
  isLiked: boolean;
  isFollowed: boolean;
  isPending: boolean;
  onLike: () => void;
  /** Absent for a proposal's own author — see {@link useProposalEngagement}. */
  onFollow?: () => void;
}

/**
 * Like/follow for a proposal, shared by the card's metric toggles and the
 * detail view's engagement row so the two can't drift.
 *
 * Returns `undefined` when the viewer can't act — anonymous visitors, and roles
 * without engagement access on the parent decision. Callers render the counts
 * as plain numbers in that case rather than dead controls.
 *
 * An author gets no `onFollow`: they're the proposal's audience by definition.
 * Nothing writes that follow for them, so their own follower count doesn't
 * include them — this hides a control product doesn't want, it doesn't model a
 * relationship. Like is unaffected.
 *
 * Counts are NOT read here. They live on the proposal row the caller already
 * has, which the mutation refetches via `listProposals`. Don't source a count
 * from `decision.getProposal` instead — nothing invalidates that on
 * like/follow, so the number would sit frozen while the toggle flips.
 */
export function useProposalEngagement({
  proposal,
  canEngage = false,
}: {
  proposal: Proposal;
  /** Mirrors the server-side engagement gate on the parent decision. */
  canEngage?: boolean;
}): ProposalEngagement | undefined {
  const { user } = useUser();
  const canToggle = userCanInteract(user) && canEngage;

  const { isLiked, isFollowed, isLoading, handleLike, handleFollow } =
    useRelationshipMutations({
      targetProfileId: proposal.profileId,
      enabled: canToggle,
      invalidateQueries: [{ processInstanceId: proposal.processInstanceId }],
    });

  if (!canToggle) {
    return undefined;
  }

  // `submittedByProfileId` is the author's current profile at submit time, the
  // same id `useUser` exposes. Anonymous submissions keep it — `isAnonymous`
  // only hides the name.
  const isAuthor =
    proposal.submittedBy?.id !== undefined &&
    proposal.submittedBy.id === user?.currentProfile?.id;

  return {
    isLiked,
    isFollowed,
    isPending: isLoading,
    onLike: handleLike,
    // Keep the toggle for an author who already follows, or they'd be stuck
    // following with no way to undo it.
    onFollow: isAuthor && !isFollowed ? undefined : handleFollow,
  };
}
