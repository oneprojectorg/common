import { accessRoles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Minimal access role shape — id, name, description.
export const accessRoleMinimalSchema = createSelectSchema(accessRoles).pick({
  id: true,
  name: true,
  description: true,
});

export type AccessRoleMinimal = z.infer<typeof accessRoleMinimalSchema>;
