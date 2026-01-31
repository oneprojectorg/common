import { accessRoles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

const normalizedPermissionsEncoder = z.object({
  admin: z.boolean(),
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});

export const roleEncoder = createSelectSchema(accessRoles)
  .pick({
    id: true,
    name: true,
    description: true,
  })
  .extend({
    permissions: normalizedPermissionsEncoder.optional(),
  });

export type Role = z.infer<typeof roleEncoder>;
