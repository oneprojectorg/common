import { UnauthorizedError } from '../../utils';
import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';

export const getOrganization = async ({
  slug,
  id,
  user,
}: { user: User } & (
  | { id: string; slug?: undefined }
  | { id?: undefined; slug: string }
)) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  if (!slug && !id) {
    return;
  }

  // assertAccess({ organization, permission: 'read' }, user.roles);

  const result = await db.query.organizations.findFirst({
    where: slug
      ? (table, { eq }) => eq(table.slug, slug)
      : (table, { eq }) => eq(table.id, id!),
    with: {
      projects: true,
      links: true,
      headerImage: true,
      avatarImage: true,
    },
  });

  return result;
};
