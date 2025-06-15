import { aliasedTable, db, eq, getTableColumns } from '@op/db/client';
import { objectsInStorage, organizations, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';

export const matchingDomainOrganizations = async ({ user }: { user: User }) => {
  if (!user?.email) {
    return [];
  }

  // Extract domain from user's email address
  const emailDomain = user.email.split('@')[1];

  if (!emailDomain) {
    return [];
  }

  const avatarObjectsInStorage = aliasedTable(
    objectsInStorage,
    'avatarObjectsInStorage',
  );

  const results = await db
    .select({
      ...getTableColumns(organizations),
      ...getTableColumns(profiles),
      avatarImage: avatarObjectsInStorage,
    })
    .from(organizations)
    .leftJoin(profiles, eq(organizations.profileId, profiles.id))
    .leftJoin(
      avatarObjectsInStorage,
      eq(avatarObjectsInStorage.id, profiles.avatarImageId),
    )
    .where(eq(organizations.domain, emailDomain));

  return results;
};
