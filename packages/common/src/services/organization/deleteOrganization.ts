import { and, db, eq } from '@op/db/client';
import { organizations } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export interface DeleteOrganizationParams {
  organizationId: string;
  user: User;
}

export async function deleteOrganization({
  organizationId,
  user,
}: DeleteOrganizationParams) {
  if (!user) {
    throw new UnauthorizedError();
  }

  // Get the org access user and assert admin UPDATE permissions
  const orgUser = await getOrgAccessUser({ user, organizationId });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  assertAccess({ admin: permission.UPDATE }, orgUser?.roles || []);

  // Check if the organization user to delete exists
  const targetOrg = await db.query.organizations.findFirst({
    where: (table, { eq, and }) => and(eq(table.id, organizationId)),
  });

  if (!targetOrg) {
    throw new NotFoundError('Organization user not found');
  }

  // Delete the organization
  // The cascade delete will handle removing org data
  const [deletedOrganization] = await db
    .delete(organizations)
    .where(and(eq(organizations.id, organizationId)))
    .returning();

  if (!deletedOrganization) {
    throw new NotFoundError('Failed to delete organization');
  }

  return deletedOrganization;
}
