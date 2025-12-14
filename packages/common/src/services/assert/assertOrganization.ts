import { db } from '@op/db/client';
import { type Organization } from '@op/db/schema';

import { NotFoundError } from '../../utils';

type AssertOrganizationParams =
  | { id: string; profileId?: never }
  | { id?: never; profileId: string };

/**
 * Fetches an organization and throws if not found.
 *
 * @throws NotFoundError if organization is not found
 */
export async function assertOrganization(
  params: AssertOrganizationParams,
): Promise<Organization> {
  const { id, profileId } = params;

  const organization = await db.query.organizations.findFirst({
    where: (table, { eq }) =>
      id ? eq(table.id, id) : eq(table.profileId, profileId!),
  });

  if (!organization) {
    throw new NotFoundError('Organization', id ?? profileId);
  }

  return organization;
}
