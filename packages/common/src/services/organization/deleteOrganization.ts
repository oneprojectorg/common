import { invalidate } from '@op/cache';
import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';

export async function deleteOrganization({
  organizationProfileId,
  user,
}: {
  organizationProfileId: string;
  user: User;
}) {
  if (!user) {
    throw new UnauthorizedError();
  }

  // Get the org access user and assert admin DELETE permissions
  const orgUser = await getProfileAccessUser({
    user,
    profileId: organizationProfileId,
  });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  assertAccess({ admin: permission.DELETE }, orgUser.roles || []);

  // Check if the organization to delete exists
  const targetOrg = await db.query.profiles.findFirst({
    where: (table, { eq }) => eq(table.id, organizationProfileId),
  });

  if (!targetOrg) {
    throw new NotFoundError('Organization not found');
  }

  // Delete the organization
  // The cascade delete will handle removing org data
  const [deletedOrganization] = await db
    .delete(profiles)
    .where(eq(profiles.id, organizationProfileId))
    .returning();

  if (!deletedOrganization) {
    throw new NotFoundError('Failed to delete organization');
  }

  await invalidate({ type: 'organization', params: [organizationProfileId] });

  return deletedOrganization;
}
