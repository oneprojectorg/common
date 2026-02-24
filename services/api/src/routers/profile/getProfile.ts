import { NotFoundError, getProfile, listProfiles } from '@op/common';
import { EntityType } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
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
      try {
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
      } catch (error: unknown) {
        console.log(error);

        if (error instanceof NotFoundError) {
          throw new TRPCError({
            message: error.message,
            code: 'NOT_FOUND',
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          message: 'Profiles not found',
          code: 'NOT_FOUND',
        });
      }
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
