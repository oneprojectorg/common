import { db } from '@op/db/client';
import type { Profile } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a profile by ID and throws if not found.
 *
 * @throws NotFoundError if profile is not found
 */
export async function assertProfile(id: string): Promise<Profile> {
  const profile = await db.query.profiles.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  if (!profile) {
    throw new NotFoundError('Profile', id);
  }

  return profile;
}

/**
 * Fetches a profile by slug and throws if not found.
 *
 * @throws NotFoundError if profile is not found
 */
export async function assertProfileBySlug(slug: string): Promise<Profile> {
  const profile = await db.query.profiles.findFirst({
    where: (table, { eq }) => eq(table.slug, slug),
  });

  if (!profile) {
    throw new NotFoundError('Profile', slug);
  }

  return profile;
}
