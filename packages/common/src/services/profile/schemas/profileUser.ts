import { profileUsers } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { accessRoleMinimalSchema } from '../../access/schemas/accessRole';
import { profileMinimalSchema } from './profileMinimal';

// Base shape — one row of `profile_users`. Anonymous users have no email.
export const profileUserSchema = createSelectSchema(profileUsers).extend({
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
