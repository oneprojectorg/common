import { accessRoles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const roleEncoder = createSelectSchema(accessRoles).pick({
  id: true,
  name: true,
  description: true,
});

export type Role = z.infer<typeof roleEncoder>;

export const roleWithPermissionsEncoder = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isGlobal: z.boolean(),
  permission: z.number().int().min(0).max(31),
});

export type RoleWithPermissions = z.infer<typeof roleWithPermissionsEncoder>;
