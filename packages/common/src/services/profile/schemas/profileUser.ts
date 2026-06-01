import { profileUsers } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { accessRoleMinimalSchema } from '../../access/schemas/accessRole';
import { profileMinimalSchema } from './profileMinimal';

// Member-facing shape of a `profile_users` row. Explicitly picked rather than a
// full table select so columns aren't leaked at API boundaries by default — new
// columns must be opted in here. Anonymous users have no email.
export const profileUserSchema = createSelectSchema(profileUsers)
  .pick({
    id: true,
    name: true,
    about: true,
    isOwner: true,
    profileId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    email: z.string().nullable(),
  });

export type ProfileUserBase = z.infer<typeof profileUserSchema>;

// Base row + linked profile; shared base for the roles and permissions shapes.
export const profileUserWithProfileSchema = profileUserSchema.extend({
  profile: profileMinimalSchema.nullable(),
});

// Member-endpoint shape (listUsers, updateUserRoles): profile + access roles.
export const profileUserWithRolesSchema = profileUserWithProfileSchema.extend({
  roles: z.array(accessRoleMinimalSchema),
});

export type ProfileUser = z.infer<typeof profileUserWithRolesSchema>;
