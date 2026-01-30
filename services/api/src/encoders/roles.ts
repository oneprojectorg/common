import { accessRoles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const roleEncoder = createSelectSchema(accessRoles).pick({
  id: true,
  name: true,
  description: true,
});

export type Role = z.infer<typeof roleEncoder>;
