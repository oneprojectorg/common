import { db, eq } from '@op/db/client';
import { EntityType, profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { NotFoundError } from '../../utils';

export interface GetProfileParams {
  slug: string;
  user?: User;
}

const profileResultSchema = z.object({
  id: z.string(),
  type: z.enum([EntityType.INDIVIDUAL, EntityType.ORG, EntityType.PROPOSAL]),
  name: z.string(),
  slug: z.string(),
  bio: z.string().nullable(),
  mission: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  avatarImage: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      metadata: z.any(),
    })
    .nullable(),
  headerImage: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      metadata: z.any(),
    })
    .nullable(),
});

export type ProfileResult = z.infer<typeof profileResultSchema>;

export const getProfile = async ({
  slug,
  user: _user, // Currently unused but kept for future extensibility
}: GetProfileParams) => {
  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.slug, slug),
      with: {
        avatarImage: true,
        headerImage: true,
      },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return profileResultSchema.parse(profile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    console.error('Error in getProfile:', error);
    throw new NotFoundError('Profile not found');
  }
};
