import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  assertProfileTypeAccess,
} from '../access';

// Fail-closed counterpart to assertProfileTypeAccess's policy map: a type with
// no registered authorizer is denied (the map passes such types unchecked,
// which is how proposal posts leaked). The type is resolved from the DB row,
// never taken from the caller — a client-supplied type could pick a lenient
// path for a profile of a different type and reintroduce the leak.
export type PostReadAuthorizer = (args: {
  user: AccessUser | undefined;
  profileId: string;
}) => Promise<void>;

// READ grant lives on the decision profile itself.
const decisionAuthorizer: PostReadAuthorizer = async ({ user, profileId }) => {
  await assertProfileTypeAccess({
    user,
    profileIds: [profileId],
    policies: { [EntityType.DECISION]: { decisions: permission.READ } },
  });
};

// A proposal's READ grant lives on its PARENT decision (the process instance),
// never on the proposal profile — gate exactly as `getProposal` does.
const proposalAuthorizer: PostReadAuthorizer = async ({ user, profileId }) => {
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
};

// The registry. Absent type ⇒ deny. Starting with proposals + decisions;
// org/individual can register their (network-tier) authorizer here later.
const POST_READ_AUTHORIZERS: Partial<Record<EntityType, PostReadAuthorizer>> = {
  [EntityType.DECISION]: decisionAuthorizer,
  [EntityType.PROPOSAL]: proposalAuthorizer,
};

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

  // `enumToPgEnum` widens the column to `string`; narrow to look up the type.
  const authorizer = POST_READ_AUTHORIZERS[profile.type as EntityType];

  if (!authorizer) {
    throw new UnauthorizedError('You do not have access to these posts');
  }

  await authorizer({ user, profileId });
};
