import { invalidate, invalidateMultiple } from '@op/cache';
import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { getOrgAccessUser, orgUserCacheKey } from '../access';
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
  });

  // Snapshot every member's auth id BEFORE the delete, so we can bust each
  // member's orgUser cache entry — the durable cache partitions entries by
  // caller identity, so only invalidating the caller's key would leave every
  // other member's cached access alive until the 72h TTL.
  const orgMembers = await db.query.organizationUsers.findMany({
    where: { organizationId: organization.id },
    columns: { authUserId: true },
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
  await Promise.all([
    invalidate({ type: 'organization', params: [organizationProfileId] }),
    invalidate({ type: 'organization', params: [deletedOrganization.slug] }),
    invalidateMultiple({
      type: 'orgUser',
      paramsList: orgMembers.map((member) =>
        orgUserCacheKey({
          user: { id: member.authUserId },
          organizationId: organization.id,
        }),
      ),
    }),
  ]);
  for (const member of orgMembers) {
    getOrgAccessUser.invalidate({
      user: { id: member.authUserId },
      organizationId: organization.id,
    });
  }

  return { deletedId: organizationProfileId };
}
