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

const organizationUserWithPermissionsEncoder = createSelectSchema(organizationUsers)
  .extend({
    organization: organizationsEncoder.nullish(),
    permissions: zonePermissionsSchema.nullish(),
  });

export const userEncoder = createSelectSchema(users).extend({
  avatarImage: createSelectSchema(objectsInStorage).nullish(),
  organizationUsers: organizationUserWithPermissionsEncoder
    .array()
    .nullish(),
  currentOrganization: organizationsWithProfileEncoder.nullish(),
  currentProfile: baseProfileEncoder.nullish(),
  profile: baseProfileEncoder.nullish(),
});

export type CommonUser = z.infer<typeof userEncoder>;
