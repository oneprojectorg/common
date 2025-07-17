import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { NotFoundError } from '../../utils';

export interface GetProfileParams {
  slug: string;
  user?: User;
  database?: typeof db;
}

const profileResultSchema = z.object({
  id: z.string(),
  type: z.enum(['user', 'org']),
  name: z.string(),
  slug: z.string(),
  bio: z.string().nullable(),
  mission: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  avatarImage: z.object({
    id: z.string(),
    name: z.string().nullable(),
    metadata: z.any(),
  }).nullable(),
  headerImage: z.object({
    id: z.string(),
    name: z.string().nullable(),
    metadata: z.any(),
  }).nullable(),
});

export type ProfileResult = z.infer<typeof profileResultSchema>;

export const getProfile = async ({
  slug,
  user: _user, // Currently unused but kept for future extensibility
  database = db,
}: GetProfileParams) => {
  try {
    // Find the profile by slug
    const profile = await database.query.profiles.findFirst({
      where: eq(profiles.slug, slug),
      with: {
        avatarImage: true,
        headerImage: true,
      },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Return the profile data using Zod schema validation
    return profileResultSchema.parse({
      id: profile.id,
      type: profile.type as 'user' | 'org',
      name: profile.name,
      slug: profile.slug,
      bio: profile.bio,
      mission: profile.mission,
      email: profile.email,
      website: profile.website,
      city: profile.city,
      state: profile.state,
      avatarImage: profile.avatarImage
        ? {
            id: (profile.avatarImage as any).id,
            name: (profile.avatarImage as any).name,
            metadata: (profile.avatarImage as any).metadata,
          }
        : null,
      headerImage: profile.headerImage
        ? {
            id: (profile.headerImage as any).id,
            name: (profile.headerImage as any).name,
            metadata: (profile.headerImage as any).metadata,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    console.error('Error in getProfile:', error);
    throw new NotFoundError('Profile not found');
  }
};