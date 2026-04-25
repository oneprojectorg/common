import { db, eq } from '@op/db/client';
import { organizations } from '@op/db/schema';
import { checkPermission, collapseRoles, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils/error';
import { getOrgAccessUser, getProfileAccessUser } from '../access';
import { fromDecisionBitField } from './permissions';

/**
 * Asserts the user has admin access to the decision identified by `profileId`.
 *
 * No-op when `profileId` is not a decision profile — callers retain their
 * pre-existing authorization for user/org profile targets.
 *
 * Mirrors the access derivation in `getInstance.ts`'s `resolveInstanceAccess`:
 * profile.ADMIN → full access; else decision-zone `admin` bit on the profile;
 * else org-level fallback via the instance's `ownerProfileId`.
 */
export const assertDecisionProfileAdmin = async ({
  user,
  profileId,
}: {
  user: { id: string };
  profileId: string;
}): Promise<void> => {
  const instance = await db._query.processInstances.findFirst({
    where: (table, { eq }) => eq(table.profileId, profileId),
    columns: { profileId: true, ownerProfileId: true },
  });

  if (!instance) {
    return;
  }

  const profileUser = await getProfileAccessUser({ user, profileId });
  if (profileUser) {
    if (checkPermission({ profile: permission.ADMIN }, profileUser.roles)) {
      return;
    }
    const decisionBits = collapseRoles(profileUser.roles)['decisions'] ?? 0;
    if (fromDecisionBitField(decisionBits).admin) {
      return;
    }
  }

  if (instance.ownerProfileId) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.profileId, instance.ownerProfileId));

    if (org?.id) {
      const orgUser = await getOrgAccessUser({
        user,
        organizationId: org.id,
      });
      if (orgUser) {
        const decisionBits = collapseRoles(orgUser.roles)['decisions'] ?? 0;
        if (fromDecisionBitField(decisionBits).admin) {
          return;
        }
      }
    }
  }

  throw new UnauthorizedError(
    'You must be an admin of this decision to post updates.',
  );
};
