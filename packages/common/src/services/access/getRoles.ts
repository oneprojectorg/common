import { db } from '@op/db/client';

import { assertProfileBySlug } from '../assert';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Get roles for a profile or global roles.
 * - If profileSlug is provided: returns only roles specific to that profile
 * - If no profileSlug: returns only global roles (profileId IS NULL)
 */
export const getRoles = async (params?: {
  profileSlug?: string;
}): Promise<Role[]> => {
  const { profileSlug } = params ?? {};

  const profileId = profileSlug
    ? (await assertProfileBySlug(profileSlug)).id
    : null;

  const roles = await db._query.accessRoles.findMany({
    where: (table, { eq, isNull }) =>
      profileId ? eq(table.profileId, profileId) : isNull(table.profileId),
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
  }));
};
