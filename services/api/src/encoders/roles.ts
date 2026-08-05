import { accessRoles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { permissionsSchema } from './access';

export const roleEncoder = createSelectSchema(accessRoles)
  .pick({
    id: true,
    name: true,
    description: true,
  })
  .extend({
    permissions: permissionsSchema.optional(),
    // Present for profile-scoped role listings.
    memberCount: z.number().optional(),
  });

export type Role = z.infer<typeof roleEncoder>;
