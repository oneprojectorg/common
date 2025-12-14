import { db } from '@op/db/client';
import type { Organization } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches an organization by ID and throws if not found.
 *
 * @throws NotFoundError if organization is not found
 */
export async function assertOrganization(id: string): Promise<Organization> {
  const organization = await db.query.organizations.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  if (!organization) {
    throw new NotFoundError('Organization', id);
  }

  return organization;
}

/**
 * Fetches an organization by profile ID and throws if not found.
 *
 * @throws NotFoundError if organization is not found
 */
export async function assertOrganizationByProfile(
  profileId: string,
): Promise<Organization> {
  const organization = await db.query.organizations.findFirst({
    where: (table, { eq }) => eq(table.profileId, profileId),
  });

  if (!organization) {
    throw new NotFoundError('Organization', profileId);
  }

  return organization;
}
