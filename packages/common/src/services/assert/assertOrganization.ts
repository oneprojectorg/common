import { db } from '@op/db/client';
import type { Organization } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches an organization by ID and throws if not found.
 *
 * @throws NotFoundError if organization is not found
 */
export async function assertOrganization(
  id: string,
  error: Error = new NotFoundError('Organization', id),
): Promise<Organization> {
  const organization = await db.query.organizations.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  if (!organization) {
    throw error;
  }

  return organization;
}

/**
 * Fetches an organization by profile ID and throws if not found.
 *
 * @throws NotFoundError if organization is not found
 */
export async function assertOrganizationByProfileId(
  profileId: string,
  error: Error = new NotFoundError('Organization', profileId),
): Promise<Organization> {
  const organization = await db.query.organizations.findFirst({
    where: (table, { eq }) => eq(table.profileId, profileId),
  });

  if (!organization) {
    throw error;
  }

  return organization;
}
