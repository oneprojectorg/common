import { db } from '@op/db/client';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';

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

  try {
    const org = await db.query.organizations.findFirst({
      where: slug
        ? (table, { eq }) => eq(table.slug, slug)
        : (table, { eq }) => eq(table.id, id!),
      with: {
        projects: true,
        links: true,
        headerImage: true,
        avatarImage: true,
        whereWeWork: {
          with: {
            term: true,
          },
        },
        strategies: {
          with: {
            term: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundError('Could not find organization');
    }

    org.whereWeWork = org.whereWeWork.map((record) => record.term);
    org.strategies = org.strategies.map((record) => record.term);

    return org;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
