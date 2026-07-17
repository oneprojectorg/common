import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileTypeAccess } from '../access';
import { decisionPermission } from './permissions';

export type ProposalEngagementTarget = {
  proposalId: string;
  processInstanceId: string;
};

/**
 * Gate engagement (like/follow) on a proposal with the same check commenting
 * uses: `assertProfileTypeAccess` requiring SUBMIT_PROPOSALS on the parent
 * decision's profile — the exact gate `assertPostWriteAccess` applies to a
 * proposal comment once `resolvePostRoots` has walked it up to the decision.
 * Proposal profiles carry no permissions of their own.
 *
 * Throws NotFoundError when the profile is not a proposal's — proposal
 * engagement accepts only proposal targets. Returns the resolved
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
        columns: { profileId: true },
      },
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', profileId);
  }

  const decisionProfileId = proposal.processInstance.profileId;
  if (!decisionProfileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  await assertProfileTypeAccess({
    user,
    profileIds: [decisionProfileId],
    policies: {
      [EntityType.DECISION]: {
        decisions: decisionPermission.SUBMIT_PROPOSALS,
      },
    },
  });

  return {
    proposalId: proposal.id,
    processInstanceId: proposal.processInstanceId,
  };
}
