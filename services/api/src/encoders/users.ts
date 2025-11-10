import { objectsInStorage, organizationUsers, users } from '@op/db/schema';
import type { ZonePermissions } from 'access-zones';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import {
  organizationsEncoder,
  organizationsWithProfileEncoder,
} from './organizations';
import { baseProfileEncoder } from './profiles';

const permissionSchema = z.object({
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});

const zonePermissionsSchema = z.record(
  z.string(),
  permissionSchema,
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

const accessRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  zonePermissions: z.array(zonePermissionSchema).nullish(),
});

const roleJunctionSchema = z.object({
  accessRole: accessRoleSchema,
});

// Extended organization user schema that includes permissions and role data
// Used when returning user data with full organizational context
const organizationUserWithPermissionsEncoder = createSelectSchema(
  organizationUsers,
).extend({
  organization: organizationsEncoder.nullish(),
  permissions: zonePermissionsSchema.nullish(),
  roles: z.array(roleJunctionSchema).nullish(),
});

/**
 * Complete user data encoder with all relational data
 * Includes avatar, organization memberships, roles, and profile information
 */
export const userEncoder = createSelectSchema(users).extend({
  avatarImage: createSelectSchema(objectsInStorage).nullish(),
  organizationUsers: organizationUserWithPermissionsEncoder.array().nullish(),
  currentOrganization: organizationsWithProfileEncoder.nullish(),
  currentProfile: baseProfileEncoder.nullish(),
  profile: baseProfileEncoder.nullish(),
});

export type CommonUser = z.infer<typeof userEncoder>;
