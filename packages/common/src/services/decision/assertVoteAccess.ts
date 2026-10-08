import { permission } from 'access-zones';

import { assertProfileAccess } from '../assert';
import { decisionPermission } from './permissions';

export const assertVoteAccess = ({
  authUserId,
  profileId,
}: {
  authUserId: string;
  profileId: string;
}) =>
  assertProfileAccess({
    user: { id: authUserId },
    profileId,
    permissions: [
      { decisions: permission.ADMIN },
      { decisions: decisionPermission.VOTE },
    ],
  });
