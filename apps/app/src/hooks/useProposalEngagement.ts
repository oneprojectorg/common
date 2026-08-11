'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import type { Proposal } from '@op/common/client';

/** Like/follow state and handlers for a proposal's engagement controls. */
export interface ProposalEngagement {
  isLiked: boolean;
  isFollowed: boolean;
  isPending: boolean;
  onLike: () => void;
  onFollow: () => void;
}

/**
 * Like/follow for a proposal, shared by the card's metric toggles and the
 * detail view's engagement row so the two can't drift.
 *
 * Returns `undefined` when the viewer can't act — anonymous visitors, and roles
 * without engagement access on the parent decision. Callers render the counts
 * as plain numbers in that case rather than dead controls.
 *
 * Counts are NOT read here. They live on the proposal row the caller already
 * has, and the mutation invalidates `listProposals`; `decision.getProposal` is
 * never invalidated on like/follow, so reading a count from it leaves the
 * number frozen while the toggle flips.
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

  return {
    isLiked,
    isFollowed,
    isPending: isLoading,
    onLike: handleLike,
    onFollow: handleFollow,
  };
}
