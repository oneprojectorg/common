import {
  ValidationError,
  addProfileRelationship,
  getProfileRelationships,
  removeProfileRelationship,
} from '@op/common';
import { db, eq } from '@op/db/client';
import { ProfileRelationshipType, proposals } from '@op/db/schema';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import {
  trackProposalFollowed,
  trackProposalLiked,
} from '../../utils/analytics';

// Helper function to check if a profile belongs to a proposal and get process info
async function getProposalInfo(
  profileId: string,
): Promise<{ proposalId: string; processInstanceId: string } | null> {
  const proposal = await db
    .select({
      id: proposals.id,
      processInstanceId: proposals.processInstanceId,
    })
    .from(proposals)
    .where(eq(proposals.profileId, profileId))
    .limit(1);

  return proposal.length > 0
    ? {
        proposalId: proposal[0]!.id,
        processInstanceId: proposal[0]!.processInstanceId,
      }
    : null;
}

const relationshipInputSchema = z.object({
  targetProfileId: z.uuid(),
  relationshipType: z.enum([
    ProfileRelationshipType.FOLLOWING,
    ProfileRelationshipType.LIKES,
  ]),
  pending: z.boolean().optional().prefault(false),
});

const removeRelationshipInputSchema = z.object({
  targetProfileId: z.uuid(),
  relationshipType: z.enum([
    ProfileRelationshipType.FOLLOWING,
    ProfileRelationshipType.LIKES,
  ]),
});

const getRelationshipsInputSchema = z.object({
  targetProfileId: z.uuid().optional(),
  sourceProfileId: z.uuid().optional(),
  types: z
    .array(
      z.enum([
        ProfileRelationshipType.FOLLOWING,
        ProfileRelationshipType.LIKES,
      ]),
    )
    .min(1, 'At least one relationship type is required'),
  profileType: z.string().optional(),
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

const relationshipProcedure = commonAuthedProcedure({
  rateLimit: { windowSize: 10, maxRequests: 20 },
});

export const profileRelationshipRouter = router({
  addRelationship: relationshipProcedure
    .meta(addRelationshipMeta)
    .input(relationshipInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { targetProfileId, relationshipType, pending } = input;

      try {
        await addProfileRelationship({
          targetProfileId,
          relationshipType,
          authUserId: ctx.user.id,
          pending,
        });

        // Track analytics if this is a proposal relationship (async in background)
        waitUntil(
          (async () => {
            const proposalInfo = await getProposalInfo(targetProfileId);
            if (proposalInfo) {
              if (relationshipType === ProfileRelationshipType.LIKES) {
                await trackProposalLiked(
                  ctx,
                  proposalInfo.processInstanceId,
                  proposalInfo.proposalId,
                );
              } else if (
                relationshipType === ProfileRelationshipType.FOLLOWING
              ) {
                await trackProposalFollowed(
                  ctx,
                  proposalInfo.processInstanceId,
                  proposalInfo.proposalId,
                );
              }
            }
          })(),
        );

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

        logger.error('Error adding relationship', { error, targetProfileId });
        throw new TRPCError({
          message: 'Failed to add relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),

  removeRelationship: relationshipProcedure
    .meta(removeRelationshipMeta)
    .input(removeRelationshipInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { targetProfileId, relationshipType } = input;

      try {
        await removeProfileRelationship({
          targetProfileId,
          relationshipType,
          authUserId: ctx.user.id,
        });
        return { success: true };
      } catch (error) {
        logger.error('Error removing relationship', { error, targetProfileId });
        throw new TRPCError({
          message: 'Failed to remove relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),

  getRelationships: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .meta(getRelationshipsMeta)
    .input(getRelationshipsInputSchema)
    .output(
      // Always return grouped format by relationship type
      z.partialRecord(
        z.enum([
          ProfileRelationshipType.FOLLOWING,
          ProfileRelationshipType.LIKES,
        ]),
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
                avatarImage: z
                  .object({
                    id: z.string(),
                    name: z.string().nullable(),
                  })
                  .nullable(),
                type: z.string(),
              })
              .optional(),
            sourceProfile: z
              .object({
                id: z.string(),
                name: z.string(),
                slug: z.string(),
                bio: z.string().nullable(),
                avatarImage: z
                  .object({
                    id: z.string(),
                    name: z.string().nullable(),
                  })
                  .nullable(),
                type: z.string(),
              })
              .optional(),
          }),
        ),
      ),
    )
    .query(async ({ input, ctx }) => {
      const { targetProfileId, sourceProfileId, types, profileType } = input;

      try {
        // Initialize empty arrays for all requested types
        const groupedResults: Record<string, any[]> = {};
        for (const type of types) {
          groupedResults[type] = [];
        }

        // Fetch all relationships in a single database query
        const allRelationships = await getProfileRelationships({
          targetProfileId,
          sourceProfileId,
          relationshipTypes: types,
          profileType,
          authUserId: ctx.user.id,
        });

        // Group results by relationship type
        for (const relationship of allRelationships) {
          const type = relationship.relationshipType;
          if (groupedResults[type]) {
            groupedResults[type].push(relationship);
          }
        }

        return groupedResults;
      } catch (error) {
        logger.error('Error getting profile relationships', {
          error,
          targetProfileId,
          sourceProfileId,
        });
        throw new TRPCError({
          message: 'Failed to get profile relationships',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
