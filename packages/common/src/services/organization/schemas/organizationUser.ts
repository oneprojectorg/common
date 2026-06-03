import { organizationUsers } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Member-facing shape of an `organization_users` row. Explicitly picked rather
// than a full table select so columns aren't leaked at API boundaries by
// default — new columns must be opted in here. Mirrors `profileUserSchema`.
export const organizationUserSchema = createSelectSchema(
  organizationUsers,
).pick({
  id: true,
  authUserId: true,
  name: true,
  email: true,
  about: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});

export type OrganizationUserBase = z.infer<typeof organizationUserSchema>;
