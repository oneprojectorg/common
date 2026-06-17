import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  assertProfileTypeAccess,
} from '../access';

// Asserts a caller's READ access to a profile's posts, dispatching on the
// profile's server-resolved type. Fail-closed: a type without a case is denied
// (unlike assertProfileTypeAccess, whose policy map passes unlisted types and
// leaked proposal posts). The type comes from the DB row, never the caller.
export const assertPostReadAccess = async ({
  user,
  profileId,
}: {
  user: AccessUser | undefined;
  profileId: string;
}) => {
  const profile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { type: true },
  });

  if (!profile) {
    throw new NotFoundError('Profile', profileId);
  }

  switch (profile.type) {
    // The READ grant lives on the decision profile itself.
    case EntityType.DECISION: {
      await assertProfileTypeAccess({
        user,
        profileIds: [profileId],
        policies: { [EntityType.DECISION]: { decisions: permission.READ } },
      });
      return;
    }

    // A proposal's READ grant lives on its parent decision (the process
    // instance), never on the proposal profile — gate as getProposal does.
    case EntityType.PROPOSAL: {
      const proposal = await db.query.proposals.findFirst({
        where: { profileId },
        with: { processInstance: true },
      });

      if (!proposal) {
        throw new NotFoundError('Proposal', profileId);
      }

      await assertInstanceProfileAccess({
        user,
        instance: proposal.processInstance,
        profilePermissions: { decisions: permission.READ },
        orgFallbackPermissions: [
          { decisions: permission.READ },
          { decisions: permission.ADMIN },
        ],
      });
      return;
    }

    default:
      throw new UnauthorizedError('You do not have access to these posts');
  }
};
