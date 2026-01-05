import { invalidate } from '@op/cache';
import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

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

  // First, find the organization by its profile ID to get the organization ID
  const organization = await db.query.organizations.findFirst({
    where: (table, { eq }) => eq(table.profileId, organizationProfileId),
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  // Get the org access user and assert admin DELETE permissions
  const orgUser = await getOrgAccessUser({
    user,
    organizationId: organization.id,
  });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  assertAccess({ profile: permission.DELETE }, orgUser.roles || []);

  // Delete the organization profile
  // The cascade delete will handle removing org data
  const [deletedOrganization] = await db
    .delete(profiles)
    .where(eq(profiles.id, organizationProfileId))
    .returning();

  if (!deletedOrganization) {
    throw new NotFoundError('Failed to delete organization');
  }

  // Invalidate caches for the deleted organization
  invalidate({ type: 'organization', params: [organizationProfileId] });
  invalidate({ type: 'organization', params: [deletedOrganization.slug] });
  invalidate({ type: 'orgUser', params: [organization.id, user.id] });

  return deletedOrganization;
}
