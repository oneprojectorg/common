import { GLOBAL_USER_PUBLIC } from '@op/core';
import { type DbClient, db } from '@op/db/client';
import { permission } from 'access-zones';

import { getRoleIdsWithPermission } from './getRoleIdsWithPermission';

interface DecisionAdmin {
  authUserId: string;
  email: string | null;
}

/**
 * Every member of the decision profile holding a role with `profile: ADMIN` or
 * `decisions: ADMIN` on it, once each, with their auth email.
 */
export async function getDecisionAdmins({
  decisionProfileId,
  dbClient = db,
}: {
  decisionProfileId: string;
  dbClient?: DbClient;
}): Promise<DecisionAdmin[]> {
  const adminRoleIds = await getRoleIdsWithPermission({
    profileId: decisionProfileId,
    zoneNames: ['profile', 'decisions'],
    permission: permission.ADMIN,
    dbClient,
  });

  if (adminRoleIds.length === 0) {
    return [];
  }

  const members = await dbClient.query.profileUsers.findMany({
    where: {
      profileId: decisionProfileId,
      authUserId: { ne: GLOBAL_USER_PUBLIC },
      roles: { accessRoleId: { in: adminRoleIds } },
    },
    columns: { authUserId: true },
    with: { authUser: { columns: { email: true } } },
  });

  const adminByAuthUserId = new Map<string, DecisionAdmin>();
  for (const member of members) {
    adminByAuthUserId.set(member.authUserId, {
      authUserId: member.authUserId,
      email: member.authUser.email,
    });
  }

  return [...adminByAuthUserId.values()];
}
