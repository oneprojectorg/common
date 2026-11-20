import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { type DevelopLock, getDevelopLock } from './developLock';
import { getPhases } from './instancePhases';
import { isDevelopedProposal } from './isDevelopedProposal';

/**
 * The develop lock of the entry's owner, who prepared it: a co-author may
 * edit the entry only while its owner may. Readers: members of the entry's
 * own profile.
 */
export async function getDevelopEntryLock({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<{ lock: DevelopLock | null; processInstanceId: string }> {
  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    columns: { id: true, profileId: true },
    with: {
      processInstance: {
        columns: {
          id: true,
          profileId: true,
          currentStateId: true,
          instanceData: true,
        },
      },
      profile: {
        columns: {},
        with: {
          profileUsers: {
            where: { isOwner: true },
            columns: { authUserId: true },
            orderBy: { createdAt: 'asc', id: 'asc' },
            limit: 1,
          },
        },
      },
    },
  });

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: proposal.profileId,
    permissions: { profile: permission.READ },
  });

  if (!(await isDevelopedProposal(proposal.id))) {
    throw new ValidationError('This proposal was not developed from another');
  }

  const instance = proposal.processInstance;
  const owner = proposal.profile.profileUsers[0];
  const phases = await getPhases({ instance });

  const lock = await getDevelopLock({
    instance: { ...instance, phases },
    user: owner ? { id: owner.authUserId } : undefined,
  });

  return { lock, processInstanceId: instance.id };
}
