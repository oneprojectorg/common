import { db } from '@op/db/client';
import { type Profile } from '@op/db/schema';

import { NotFoundError } from '../../utils';

type AssertProfileParams =
  | { id: string; slug?: never }
  | { id?: never; slug: string };

/**
 * Fetches a profile and throws if not found.
 *
 * @throws NotFoundError if profile is not found
 */
export async function assertProfile(
  params: AssertProfileParams,
): Promise<Profile> {
  const { id, slug } = params;

  const profile = await db.query.profiles.findFirst({
    where: (table, { eq }) =>
      id ? eq(table.id, id) : eq(table.slug, slug!),
  });

  if (!profile) {
    throw new NotFoundError('Profile', id ?? slug);
  }

  return profile;
}
