import { invalidate } from '@op/cache';
import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { getOrgAccessUser } from '../access';
import { assertOrgAccess } from '../assert';

export async function deleteOrganization({
  organizationProfileId,
  user,
}: {
  organizationProfileId: string;
  user: User;
}) {
  // First, find the organization by its profile ID to get the organization ID
  const organization = await db.query.organizations.findFirst({
    where: { profileId: organizationProfileId },
  });

  if (!organization) {
    throw new NotFoundError('Organization', organizationProfileId);
  }

  // Assert the user has admin DELETE permissions on the organization
  await assertOrgAccess({
    user,
    organizationId: organization.id,
    permissions: { profile: permission.DELETE },
    notMemberMessage: 'You are not a member of this organization',
  });

  // Delete the organization profile
  // The cascade delete will handle removing org data
  const [deletedOrganization] = await db
    .delete(profiles)
    .where(eq(profiles.id, organizationProfileId))
    .returning();

  if (!deletedOrganization) {
    throw new NotFoundError('Organization', organizationProfileId);
  }

  // Invalidate caches for the deleted organization
  invalidate({ type: 'organization', params: [organizationProfileId] });
  invalidate({ type: 'organization', params: [deletedOrganization.slug] });
  invalidate({ type: 'orgUser', params: [organization.id, user.id] });
  getOrgAccessUser.invalidate({ user, organizationId: organization.id });

  return { deletedId: organizationProfileId };
}
