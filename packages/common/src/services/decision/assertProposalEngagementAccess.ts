import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { decisionPermission } from './permissions';

type ProposalEngagementTarget = {
  proposalId: string;
  processInstanceId: string;
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

  return {
    proposalId: proposal.id,
    processInstanceId: proposal.processInstanceId,
  };
}
