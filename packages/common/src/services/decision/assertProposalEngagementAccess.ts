import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { decisionPermission } from './permissions';

export type ProposalEngagementTarget = {
  proposalId: string;
  processInstanceId: string;
};

/**
 * Gate engagement (like/follow) on a proposal the same way commenting is gated:
 * the caller needs SUBMIT_PROPOSALS on the proposal's parent decision. Proposal
 * profiles carry no permissions of their own, so the grant is resolved on the
 * process instance — mirroring how `assertPostWriteAccess` walks a proposal
 * comment up to its decision.
 *
 * Keeps like/follow consistent with comments: whatever a claimed account may
 * comment on, it may also like, and nothing more.
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
