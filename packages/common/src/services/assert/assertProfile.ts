import { db } from '@op/db/client';
import type { Profile } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a profile by ID and throws if not found.
 *
 * @param id - The profile ID to look up
 * @param error - Custom error to throw if not found (defaults to NotFoundError)
 * @throws The provided error or NotFoundError if profile is not found
 */
export async function assertProfile(
  id: string,
  error: Error = new NotFoundError('Profile', id),
): Promise<Profile> {
  const profile = await db.query.profiles.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  if (!profile) {
    throw error;
  }

  return profile;
}

/**
 * Fetches a profile by slug and throws if not found.
 *
 * @param slug - The profile slug to look up
 * @param error - Custom error to throw if not found (defaults to NotFoundError)
 * @throws The provided error or NotFoundError if profile is not found
 */
export async function assertProfileBySlug(
  slug: string,
  error: Error = new NotFoundError('Profile', slug),
): Promise<Profile> {
  const profile = await db.query.profiles.findFirst({
    where: (table, { eq }) => eq(table.slug, slug),
  });

  if (!profile) {
    throw error;
  }

  return profile;
}
