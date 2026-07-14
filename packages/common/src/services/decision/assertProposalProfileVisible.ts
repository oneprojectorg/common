import { db } from '@op/db/client';
import type { ProcessInstance } from '@op/db/schema';
import { ProposalStatus, Visibility } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessRoles } from '../access';
import { hasActiveModerationFlag } from '../moderation/moderationVisibility';

/** The proposal fields the visibility gate needs — a subset every caller
 * already has after loading the proposal + its instance. */
// status/visibility are enum columns Drizzle infers as string; the equality
// checks below compare against the enum values, so widen to string here.
type VisibilityProposal = {
  id: string;
  profileId: string;
  status: string | null;
  visibility: string | null;
  processInstance: ProcessInstance;
};

/**
 * Assert the caller may view a proposal, applying the base instance-read gate
 * plus the draft/hidden/flagged restrictions. Throws NotFoundError (never
 * Unauthorized) so a restricted proposal's existence never leaks. Returns
 * `isFlagged` so a caller that fetched the proposal for another purpose can
 * reuse it without a second moderation lookup.
 *
 * Single source of truth for proposal visibility: `getProposal` gates its read
 * through here, and `addRelationship` gates like/follow through here — the two
 * must not drift, or a like on a hidden proposal would bump its public count.
 */
export async function assertProposalProfileVisible({
  user,
  proposal,
}: {
  user: User | undefined;
  proposal: VisibilityProposal;
}): Promise<{ isFlagged: boolean }> {
  const instanceRoles = await assertInstanceProfileAccess({
    user,
    instance: proposal.processInstance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: [
      { decisions: permission.READ },
      { decisions: permission.ADMIN },
    ],
  });

  const isFlagged = await hasActiveModerationFlag('proposal', proposal.id);
  const isDraft = proposal.status === ProposalStatus.DRAFT;
  const isHidden = proposal.visibility === Visibility.HIDDEN;

  if (isDraft || isHidden || isFlagged) {
    // Proposal-level access = the creator + invited collaborators (a
    // profileUsers record on the proposal's own profile).
    const proposalRoles = await getProfileAccessRoles({
      user,
      profileId: proposal.profileId,
    });
    const hasProposalAccess = proposalRoles.length > 0;
    const isInstanceAdmin = checkPermission(
      { profile: permission.ADMIN },
      instanceRoles,
    );

    // Drafts are visible only to proposal-level access (not instance admins);
    // hidden and flagged proposals are visible to that audience OR instance
    // admins.
    const visibleToCaller = isDraft
      ? hasProposalAccess
      : hasProposalAccess || isInstanceAdmin;
    if (!visibleToCaller) {
      throw new NotFoundError('Proposal', proposal.profileId);
    }
  }

  return { isFlagged };
}

/**
 * Visibility gate keyed by profile id, for callers that only hold the target
 * profile (e.g. the like/follow mutation). No-ops when the profile isn't a
 * proposal — org and person profiles are public and carry no visibility gate.
 */
export async function assertProposalProfileVisibleById({
  user,
  profileId,
}: {
  user: User | undefined;
  profileId: string;
}): Promise<void> {
  const proposal = await db.query.proposals.findFirst({
    where: { profileId },
    columns: { id: true, profileId: true, status: true, visibility: true },
    with: { processInstance: true },
  });

  if (!proposal) {
    return;
  }

  await assertProposalProfileVisible({ user, proposal });
}
