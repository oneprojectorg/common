import { NotFoundError, getProfile, listProfiles } from '@op/common';
import { EntityType } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { profileEncoder } from '../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = z.object({
  slug: z.string(),
});

const getBySlugMeta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/profile/{slug}',
    protect: true,
    tags: ['profile'],
    summary: 'Get profile by slug',
  },
};

const listMeta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/profile',
    protect: true,
    tags: ['profile'],
    summary: 'List profiles',
  },
};

// Use the profile encoder directly
const universalProfileSchema = profileEncoder;

export const getProfileRouter = router({
  list: commonAuthedProcedure
    .meta(listMeta)
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
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ input }) => {
      const { limit = 10, cursor, orderBy, dir, types } = input ?? {};
      try {
        const { items, next, hasMore } = await listProfiles({
          cursor,
          limit,
          orderBy,
          dir,
          types,
        });

        return {
          items: items.map((profile) => universalProfileSchema.parse(profile)),
          next,
          hasMore,
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
  getBySlug: commonAuthedProcedure
    .meta(getBySlugMeta)
    .input(inputSchema)
    .output(universalProfileSchema)
    .query(async ({ ctx, input }) => {
      const { slug } = input;
      const { user } = ctx;

      try {
        // Use the profile service to get profile data
        const profile = await getProfile({
          slug,
          user,
        });

        // Transform modules to simplified format
        const transformedProfile = {
          ...profile,
          modules: profile.modules?.map((profileModule: any) => ({
            slug: profileModule.module.slug,
          })),
        };

        // Return the profile data using the profile encoder
        return universalProfileSchema.parse(transformedProfile);
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
          message: 'Profile not found',
          code: 'NOT_FOUND',
        });
      }
    }),
});
