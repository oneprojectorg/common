import { db, inArray } from '@op/db/client';
import { profileUsers } from '@op/db/schema';

export const memberProfileIds = (authUserIds: readonly string[]) =>
  db
    .select({ profileId: profileUsers.profileId })
    .from(profileUsers)
    .where(inArray(profileUsers.authUserId, [...authUserIds]));
