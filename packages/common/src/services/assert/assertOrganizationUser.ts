import { db } from '@op/db/client';
import { type OrganizationUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

type AssertOrganizationUserParams =
  | { id: string; organizationId?: never; authUserId?: never }
  | { id?: never; organizationId: string; authUserId: string };

/**
 * Fetches an organization user and throws if not found.
 * Can look up by id, or by organizationId + authUserId combination.
 *
 * @throws NotFoundError if organization user is not found
 */
export async function assertOrganizationUser(
  params: AssertOrganizationUserParams,
): Promise<OrganizationUser> {
  const { id, organizationId, authUserId } = params;

  const organizationUser = await db.query.organizationUsers.findFirst({
    where: (table, { eq, and }) =>
      id
        ? eq(table.id, id)
        : and(
            eq(table.organizationId, organizationId!),
            eq(table.authUserId, authUserId!),
          ),
  });

  if (!organizationUser) {
    const identifier = id ?? `org:${organizationId}/user:${authUserId}`;
    throw new NotFoundError('OrganizationUser', identifier);
  }

  return organizationUser;
}
