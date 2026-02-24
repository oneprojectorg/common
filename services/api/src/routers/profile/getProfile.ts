import { getProfile, listProfiles } from '@op/common';
import { EntityType } from '@op/db/schema';
import { z } from 'zod';

import { profileEncoder } from '../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = z.object({
  slug: z.string(),
});

// Use the profile encoder directly
const universalProfileSchema = profileEncoder;

export const getProfileRouter = router({
  list: commonAuthedProcedure()
    .input(
      dbFilter
        .extend({
          types: z.array(z.enum(EntityType)).optional(),
          orderBy: z.enum(['createdAt', 'updatedAt', 'name']).optional(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(universalProfileSchema),
        next: z.string().nullish(),
      }),
    )
    .query(async ({ input }) => {
      const { limit = 10, cursor, orderBy, dir, types } = input ?? {};
      const { items, next } = await listProfiles({
        cursor,
        limit,
        orderBy,
        dir,
        types,
      });

      return {
        items: items.map((profile) => universalProfileSchema.parse(profile)),
        next,
      };
    }),
  getBySlug: commonAuthedProcedure()
    .input(inputSchema)
    .output(universalProfileSchema)
    .query(async ({ ctx, input }) => {
      const { slug } = input;
      const { user } = ctx;

      // Use the profile service to get profile data
      const profile = await getProfile({
        slug,
        user,
      });

      // Return the profile data using the profile encoder
      return universalProfileSchema.parse(profile);
    }),
});
