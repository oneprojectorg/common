import { type DbClient, db as defaultDb } from '@op/db/client';
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
 * @param db - Optional database client or transaction to use
 * @throws NotFoundError if no global role with that name exists
 */
export async function assertGlobalRole(
  name: string,
  db?: DbClient,
): Promise<AccessRole> {
  const client = db ?? defaultDb;

  const role = await client.query.accessRoles.findFirst({
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
