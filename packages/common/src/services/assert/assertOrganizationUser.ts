import { db } from '@op/db/client';
import type { OrganizationUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

type AssertOrganizationUserParams =
  | { id: string; organizationId?: string; authUserId?: never }
  | { id?: never; organizationId: string; authUserId: string };

/**
 * Fetches an organization user and throws if not found.
 * Can look up by:
 * - id only
 * - id + organizationId (verifies the user belongs to the specified org)
 * - organizationId + authUserId combination
 *
 * @throws NotFoundError if organization user is not found
 */
export async function assertOrganizationUser(
  params: AssertOrganizationUserParams,
): Promise<OrganizationUser> {
  const { id, organizationId, authUserId } = params;

  const organizationUser = await db.query.organizationUsers.findFirst({
    where: (table, { eq, and }) => {
      if (id && organizationId) {
        return and(eq(table.id, id), eq(table.organizationId, organizationId));
      }
      if (id) {
        return eq(table.id, id);
      }
      // At this point, we know organizationId and authUserId are defined
      // because of the discriminated union type
      return and(
        eq(table.organizationId, organizationId as string),
        eq(table.authUserId, authUserId as string),
      );
    },
  });

  if (!organizationUser) {
    const identifier = id ?? `org:${organizationId}/user:${authUserId}`;
    throw new NotFoundError('OrganizationUser', identifier);
  }

  return organizationUser;
}
