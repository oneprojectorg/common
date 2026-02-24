import { db } from '@op/db/client';
import type { AccessRole } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a global (unscoped) access role by name and throws if not found.
 *
 * Global roles have `profileId: null` — they are the seeded system roles
 * shared across all profiles (e.g. "Admin", "Member"). This distinguishes
 * them from profile-scoped roles created dynamically per decision instance.
 *
 * @param name - The role name to look up (e.g. "Admin")
 * @throws NotFoundError if no global role with that name exists
 */
export async function assertGlobalRole(name: string): Promise<AccessRole> {
  const role = await db.query.accessRoles.findFirst({
    where: {
      name,
      profileId: { isNull: true },
    },
  });

  if (!role) {
    throw new NotFoundError('Global role', name);
  }

  return role;
}
