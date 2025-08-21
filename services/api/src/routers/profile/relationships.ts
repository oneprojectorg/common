import {
  ValidationError,
  addProfileRelationship,
  getProfileRelationships,
  removeProfileRelationship,
} from '@op/common';
import { ProfileRelationshipType } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const relationshipInputSchema = z.object({
  targetProfileId: z.string().uuid(),
  relationshipType: z.enum([
    ProfileRelationshipType.FOLLOWING,
    ProfileRelationshipType.LIKES,
  ]),
  pending: z.boolean().optional().default(false),
});

const removeRelationshipInputSchema = z.object({
  targetProfileId: z.string().uuid(),
  relationshipType: z.enum([
    ProfileRelationshipType.FOLLOWING,
    ProfileRelationshipType.LIKES,
  ]),
});

const getRelationshipsInputSchema = z.object({
  targetProfileId: z.string().uuid().optional(),
  sourceProfileId: z.string().uuid().optional(),
});

const addRelationshipMeta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/profile/relationship/{targetProfileId}',
    protect: true,
    tags: ['profile'],
    summary: 'Add a relationship to a profile',
  },
};

const removeRelationshipMeta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/profile/relationship/{targetProfileId}',
    protect: true,
    tags: ['profile'],
    summary: 'Remove a relationship to a profile',
  },
};

const getRelationshipsMeta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/profile/relationship',
    protect: true,
    tags: ['profile'],
    summary: 'Get relationships to a profile',
  },
};

export const profileRelationshipRouter = router({
  addRelationship: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .meta(addRelationshipMeta)
    .input(relationshipInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      const { targetProfileId, relationshipType, pending } = input;

      try {
        await addProfileRelationship({
          targetProfileId,
          relationshipType,
          pending,
        });
        return { success: true };
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new TRPCError({
            message: error.message,
            code: 'BAD_REQUEST',
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        console.error('Error adding relationship:', error);
        throw new TRPCError({
          message: 'Failed to add relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),

  removeRelationship: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .meta(removeRelationshipMeta)
    .input(removeRelationshipInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      const { targetProfileId, relationshipType } = input;

      try {
        await removeProfileRelationship({ targetProfileId, relationshipType });
        return { success: true };
      } catch (error) {
        console.error('Error removing relationship:', error);
        throw new TRPCError({
          message: 'Failed to remove relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),

  getRelationships: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 100 }))
    .use(withAuthenticated)
    .meta(getRelationshipsMeta)
    .input(getRelationshipsInputSchema)
    .output(
      z.array(
        z.object({
          relationshipType: z.string(),
          pending: z.boolean().nullable(),
          createdAt: z.string().nullable(),
          targetProfile: z
            .object({
              id: z.string(),
              name: z.string(),
              slug: z.string(),
              bio: z.string().nullable(),
              avatarImage: z.string().nullable(),
              type: z.string(),
            })
            .optional(),
          sourceProfile: z
            .object({
              id: z.string(),
              name: z.string(),
              slug: z.string(),
              bio: z.string().nullable(),
              avatarImage: z.string().nullable(),
              type: z.string(),
            })
            .optional(),
        }),
      ),
    )
    .query(async ({ input }) => {
      const { targetProfileId, sourceProfileId } = input;

      try {
        const relationships = await getProfileRelationships({
          targetProfileId,
          sourceProfileId,
        });
        return relationships;
      } catch (error) {
        console.error('Error getting profile relationships:', error);
        throw new TRPCError({
          message: 'Failed to get profile relationships',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
