import {
  Channels,
  addProfileRelationship,
  getProfileRelationships,
  liveMergeEdgeFrom,
  removeProfileRelationship,
} from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProfileRelationshipType,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import {
  networkAuthenticatedProcedure,
  openProcedure,
  router,
} from '../../trpcFactory';
import {
  trackProposalFollowed,
  trackProposalLiked,
} from '../../utils/analytics';

type ProposalInfo = {
  proposalId: string;
  processInstanceId: string;
  mergedIntoProposalId: string | null;
};

// Helper function to check if a profile belongs to a proposal and get process info
async function getProposalInfo(
  profileId: string,
): Promise<ProposalInfo | null> {
  const [proposal] = await db
    .select({
      proposalId: proposals.id,
      processInstanceId: proposals.processInstanceId,
      mergedIntoProposalId: proposalRelationships.targetProposalId,
    })
    .from(proposals)
    .leftJoin(proposalRelationships, liveMergeEdgeFrom(proposals.id))
    .where(eq(proposals.profileId, profileId))
    .limit(1);

  return proposal ?? null;
}

// Channels the proposal detail query subscribes to: the liked proposal, plus
// the one its likes roll up into. Deliberately not the `decisionProposals`
// list channel, which would make every viewer refetch every card on every like.
function proposalRelationshipChannels({
  processInstanceId,
  proposalId,
  mergedIntoProposalId,
}: ProposalInfo) {
  return [
    Channels.decisionProposal(processInstanceId, proposalId),
    ...(mergedIntoProposalId
      ? [Channels.decisionProposal(processInstanceId, mergedIntoProposalId)]
      : []),
  ];
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

const relationshipProcedure = networkAuthenticatedProcedure({
  rateLimit: { windowSize: 10, maxRequests: 20 },
});

export const profileRelationshipRouter = router({
  addRelationship: relationshipProcedure
    .input(relationshipInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetProfileId, relationshipType, pending } = input;

      await addProfileRelationship({
        targetProfileId,
        relationshipType,
        authUserId: ctx.user.id,
        pending,
      });

      // Register the channels that proposal detail / list queries subscribe
      // to so the engagement counts refresh immediately, and track analytics.
      const proposalInfo = await getProposalInfo(targetProfileId);
      if (proposalInfo) {
        ctx.registerMutationChannels(
          proposalRelationshipChannels(proposalInfo),
        );

        waitUntil(
          (async () => {
            if (relationshipType === ProfileRelationshipType.LIKES) {
              await trackProposalLiked(
                ctx,
                proposalInfo.processInstanceId,
                proposalInfo.proposalId,
              );
            } else if (relationshipType === ProfileRelationshipType.FOLLOWING) {
              await trackProposalFollowed(
                ctx,
                proposalInfo.processInstanceId,
                proposalInfo.proposalId,
              );
            }
          })(),
        );
      }
    }),

  removeRelationship: relationshipProcedure
    .input(removeRelationshipInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetProfileId, relationshipType } = input;

      await removeProfileRelationship({
        targetProfileId,
        relationshipType,
        authUserId: ctx.user.id,
      });

      const proposalInfo = await getProposalInfo(targetProfileId);
      if (proposalInfo) {
        ctx.registerMutationChannels(
          proposalRelationshipChannels(proposalInfo),
        );
      }
    }),

  getRelationships: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
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

      const groupedResults: Record<string, any[]> = {};
      for (const type of types) {
        groupedResults[type] = [];
      }

      const allRelationships = await getProfileRelationships({
        targetProfileId,
        sourceProfileId,
        relationshipTypes: types,
        profileType,
        authUserId: ctx.user?.id,
      });

      for (const relationship of allRelationships) {
        const type = relationship.relationshipType;
        if (groupedResults[type]) {
          groupedResults[type].push(relationship);
        }
      }

      return groupedResults;
    }),
});
