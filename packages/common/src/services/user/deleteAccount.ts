import { invalidate } from '@op/cache';
import { db, eq } from '@op/db/client';
import { organizationUsers, profiles, users } from '@op/db/schema';
import { createSBServiceClient } from '@op/supabase/server';
import type { User } from '@supabase/supabase-js';

import { NotFoundError } from '../../utils';

export async function deleteAccount({ user }: { user: User }) {
  const [dbUser] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, user.id));

  if (!dbUser) {
    throw new NotFoundError('User', user.id);
  }

  const orgMemberships = await db
    .select({ organizationId: organizationUsers.organizationId })
    .from(organizationUsers)
    .where(eq(organizationUsers.authUserId, user.id));

  // Delete the individual profile first. users.profileId is ON DELETE SET NULL,
  // so the subsequent auth-user cascade still removes the users row cleanly.
  if (dbUser.profileId) {
    const [deletedProfile] = await db
      .delete(profiles)
      .where(eq(profiles.id, dbUser.profileId))
      .returning();

    if (deletedProfile) {
      invalidate({ type: 'profile', params: [deletedProfile.id] });
      invalidate({ type: 'profile', params: [deletedProfile.slug] });
    }
  }

  // Deleting the auth user cascades to public.users and organization_users.
  const supabase = createSBServiceClient();
  const { error } = await supabase.auth.admin.deleteUser(user.id);

  if (error) {
    throw error;
  }

  invalidate({ type: 'user', params: [user.id] });
  for (const { organizationId } of orgMemberships) {
    invalidate({ type: 'orgUser', params: [organizationId, user.id] });
  }

  return { deletedId: user.id };
}
