import {
  accessRoleMinimalSchema,
  organizationUserSchema,
  profileUserWithProfileSchema,
} from '@op/common/client';
import { authUsers, users } from '@op/db/schema';
import type { ZonePermissions } from 'access-zones';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { permissionsSchema } from './access';
import {
  organizationsEncoder,
  organizationsWithProfileEncoder,
} from './organizations';
import { baseProfileEncoder } from './profiles';
import { storageItemEncoder } from './storageItem';

const zonePermissionsSchema = z.record(
  z.string(),
  permissionsSchema,
) satisfies z.ZodType<ZonePermissions>;

const accessZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
});

const zonePermissionSchema = z.object({
  accessRoleId: z.string(),
  accessZoneId: z.string(),
  permission: z.number(),
  accessZone: accessZoneSchema,
});

// Extend the shared minimal encoder with zone permissions for full role context
const accessRoleSchema = accessRoleMinimalSchema.extend({
  zonePermissions: z.array(zonePermissionSchema).nullish(),
});

const roleJunctionSchema = z.object({
  accessRole: accessRoleSchema,
});

// Extended organization user schema that includes permissions and role data
// Used when returning user data with full organizational context
const organizationUserWithPermissionsEncoder = organizationUserSchema.extend({
  organization: organizationsEncoder.nullish(),
  permissions: zonePermissionsSchema.nullish(),
  roles: z.array(roleJunctionSchema).nullish(),
});

// Shared base + profile, plus computed permissions. Roles are omitted: they're
// fetched only to derive `permissions` and no client reads them off the account.
const profileUserWithPermissionsEncoder = profileUserWithProfileSchema.extend({
  permissions: zonePermissionsSchema.nullish(),
});

/**
 * Complete user data encoder with all relational data
 * Includes avatar, organization memberships, roles, and profile information
 */
export const userEncoder = createSelectSchema(users)
  .pick({
    id: true,
    authUserId: true,
    name: true,
    email: true,
    lastOrgId: true,
    profileId: true,
    currentProfileId: true,
    tos: true,
    privacy: true,
    createdAt: true,
  })
  .extend({
    onboardedAt: z.string().nullish(),
    tosAcceptedOn: z.string().nullish(),
    privacyAcceptedOn: z.string().nullish(),
    isAnonymous: z.boolean(),
    // Closed-network membership; authoritative only via `encodeUser`.
    isNetworkMember: z.boolean().default(false),
    avatarImage: storageItemEncoder.nullish(),
    organizationUsers: organizationUserWithPermissionsEncoder.array().nullish(),
    profileUsers: profileUserWithPermissionsEncoder.array().nullish(),
    currentOrganization: organizationsWithProfileEncoder.nullish(),
    currentProfile: baseProfileEncoder.nullish(),
    profile: baseProfileEncoder.nullish(),
  });

export type CommonUser = z.infer<typeof userEncoder>;

// Platform-admin list entry: shared fields plus last sign-in (admin-only).
export const adminUserEncoder = userEncoder.extend({
  lastSignInAt: createSelectSchema(authUsers).shape.lastSignInAt.nullish(),
});

/**
 * Encode a DB user row into a `CommonUser`. `isAnonymous` comes from the
 * Supabase auth identity; `isNetworkMember` is resolved by the caller (see
 * `getNetworkMembership`) and defaults to `false`.
 */
export const encodeUser = ({
  user,
  authUser,
  isNetworkMember,
}: {
  user: Record<string, unknown>;
  authUser: { is_anonymous?: boolean | null };
  isNetworkMember?: boolean;
}): CommonUser =>
  userEncoder.parse({
    ...user,
    isAnonymous: Boolean(authUser.is_anonymous),
    isNetworkMember,
  });
