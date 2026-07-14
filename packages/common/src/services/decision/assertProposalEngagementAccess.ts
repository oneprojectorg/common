import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import { decisionPermission } from './permissions';

/**
 * Gate engagement (like/follow) on a proposal the same way commenting is gated:
 * the caller needs SUBMIT_PROPOSALS on the proposal's parent decision. Proposal
 * profiles carry no permissions of their own, so the grant is resolved on the
 * process instance — mirroring how `assertPostWriteAccess` walks a proposal
 * comment up to its decision. No-op for non-proposal targets (org and person
 * profiles are public), so a like on those falls straight through.
 *
 * Keeps like/follow consistent with comments: whatever a claimed account may
 * comment on, it may also like, and nothing more.
 */
export async function assertProposalEngagementAccess({
  user,
  profileId,
}: {
  user: User | undefined;
  profileId: string;
}): Promise<void> {
  const proposal = await db.query.proposals.findFirst({
    where: { profileId },
    columns: {},
    with: {
      processInstance: {
        columns: { profileId: true, ownerProfileId: true },
      },
    },
  });

  if (!proposal) {
    return;
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
}
