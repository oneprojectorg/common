import { invalidate } from '@op/cache';
import { db, eq, inArray } from '@op/db/client';
import {
  objectsInStorage,
  organizations,
  processInstances,
  profiles,
} from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getOrgAccessUser } from '../access';

/**
 * Result of organization deletion including storage cleanup info.
 */
export interface DeleteOrganizationResult {
  success: boolean;
  deletedId: string;
  deletedProfileId: string;
  /** Storage objects to clean up (avatar/banner images) */
  storageObjectsToDelete: Array<{ bucket: string; path: string }>;
}

/**
 * Deletes an organization and all its associated data.
 *
 * Authorization: Requires profile:ADMIN permission on the organization.
 *
 * Cascade behavior (handled by database constraints):
 * - organization_users (and their role assignments)
 * - organizations_terms, organizations_where_we_work, organizations_strategies
 * - organization_relationships
 * - links
 * - posts_to_organizations
 * - profile (which cascades to posts, profile_users, profile_modules, etc.)
 *
 * Validation:
 * - Cannot delete organization with active decision processes
 *
 * Storage: Returns storage object IDs for avatar/banner images that should
 * be cleaned up by the caller via Supabase Storage API.
 */
export async function deleteOrganization({
  organizationId,
  user,
}: {
  organizationId: string;
  user: User;
}): Promise<DeleteOrganizationResult> {
  if (!user) {
    throw new UnauthorizedError();
  }

  // Get the org access user and assert admin permissions
  const orgUser = await getOrgAccessUser({ user, organizationId });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  // Require profile:ADMIN permission to delete an organization
  assertAccess({ profile: permission.ADMIN }, orgUser?.roles || []);

  // Fetch the organization with its profile
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    with: {
      profile: {
        columns: {
          id: true,
          name: true,
          avatarImageId: true,
          headerImageId: true,
        },
      },
    },
  });

  if (!organization) {
    throw new NotFoundError('Organization', organizationId);
  }

  // Check for active decision processes owned by this organization's profile
  const activeProcesses = await db.query.processInstances.findMany({
    where: eq(processInstances.ownerProfileId, organization.profileId),
    columns: {
      id: true,
      status: true,
    },
  });

  const hasActiveProcesses = activeProcesses.some(
    (process) =>
      process.status !== 'completed' && process.status !== 'cancelled',
  );

  if (hasActiveProcesses) {
    throw new ValidationError(
      'Cannot delete organization with active decision processes. Please complete or archive all decision processes first.',
    );
  }

  // Store profile info for cache invalidation and storage cleanup before deletion
  const profileId = organization.profileId;
  const profile = Array.isArray(organization.profile)
    ? organization.profile[0]
    : organization.profile;
  const avatarImageId = profile?.avatarImageId ?? null;
  const headerImageId = profile?.headerImageId ?? null;

  // Collect storage object IDs to delete
  const storageImageIds = [avatarImageId, headerImageId].filter(
    (id): id is string => id !== null,
  );

  // Fetch storage object paths before deletion
  const storageObjectsToDelete: Array<{ bucket: string; path: string }> = [];

  if (storageImageIds.length > 0) {
    const storageObjects = await db
      .select({
        bucketId: objectsInStorage.bucketId,
        name: objectsInStorage.name,
      })
      .from(objectsInStorage)
      .where(inArray(objectsInStorage.id, storageImageIds));

    for (const obj of storageObjects) {
      if (obj.bucketId && obj.name) {
        storageObjectsToDelete.push({
          bucket: obj.bucketId,
          path: obj.name,
        });
      }
    }
  }

  // Delete the profile, which cascades to the organization and all related data
  // The cascade chain: profile → organization → org_users, terms, relationships, etc.
  const [deletedProfile] = await db
    .delete(profiles)
    .where(eq(profiles.id, profileId))
    .returning({ id: profiles.id, name: profiles.name });

  if (!deletedProfile) {
    throw new NotFoundError('Failed to delete organization');
  }

  // Invalidate caches
  await Promise.all([
    invalidate({
      type: 'organization',
      params: [organizationId],
    }),
    invalidate({
      type: 'profile',
      params: [profileId],
    }),
    invalidate({
      type: 'orgUser',
      params: [organizationId, user.id],
    }),
  ]);

  return {
    success: true,
    deletedId: organizationId,
    deletedProfileId: profileId,
    storageObjectsToDelete,
  };
}
