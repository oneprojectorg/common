import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { decisionPermission } from './permissions';
import { findLiveMergedEdge } from './proposalSupersession';

type ProposalEngagementTarget = {
  proposalId: string;
  processInstanceId: string;
  /**
   * The proposal this one was merged into, or `null` when it still stands on
   * its own. A merged-away proposal stays likeable, and its likes roll up into
   * this one, so the caller has a second page to invalidate.
   */
  mergedIntoProposalId: string | null;
};

/**
 * Gate engagement (like/follow) on a proposal with the same permission
 * commenting requires: SUBMIT_PROPOSALS on the proposal's parent decision.
 * Proposal profiles carry no permissions of their own, so the grant is
 * resolved on the process instance — the same pattern `assertPostReadAccess`
 * uses for proposal posts (the comment write path reaches the parent decision
 * via `resolvePostRoots`).
 *
 * Throws NotFoundError when the profile is not a proposal's — the proposal
 * engagement endpoints accept only proposal targets. Returns the resolved
 * proposal/process ids so callers don't need a second lookup.
 */
export async function assertProposalEngagementAccess({
  user,
  profileId,
}: {
  user: User | undefined;
  profileId: string;
}): Promise<ProposalEngagementTarget> {
  const proposal = await db.query.proposals.findFirst({
    where: { profileId },
    columns: { id: true, processInstanceId: true },
    with: {
      processInstance: {
        columns: { profileId: true, ownerProfileId: true },
      },
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', profileId);
  }

  await assertInstanceProfileAccess({
    user,
    instance: proposal.processInstance,
    profilePermissions: { decisions: decisionPermission.SUBMIT_PROPOSALS },
    orgFallbackPermissions: [
      { decisions: decisionPermission.SUBMIT_PROPOSALS },
      { decisions: permission.ADMIN },
    ],
  });

  // Costs one indexed lookup on every like and follow. The alternative is a
  // count that silently drifts: `getMergedLikeCounts` folds this proposal's
  // likes into whatever it was merged into, so that page has to hear about it.
  const mergedEdge = await findLiveMergedEdge({
    processInstanceId: proposal.processInstanceId,
    sourceProposalId: proposal.id,
  });

  return {
    proposalId: proposal.id,
    processInstanceId: proposal.processInstanceId,
    mergedIntoProposalId: mergedEdge?.targetProposalId ?? null,
  };
}
