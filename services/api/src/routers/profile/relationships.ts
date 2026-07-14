import {
  Channels,
  addProfileRelationship,
  getProfileRelationships,
  removeProfileRelationship,
} from '@op/common';
import { db, eq } from '@op/db/client';
import { ProfileRelationshipType, proposals } from '@op/db/schema';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import {
  authenticatedConfirmedProcedure,
  openProcedure,
  router,
} from '../../trpcFactory';
import {
  trackProposalFollowed,
  trackProposalLiked,
} from '../../utils/analytics';

type ProposalInfo = { proposalId: string; processInstanceId: string };

// Helper function to check if a profile belongs to a proposal and get process info
async function getProposalInfo(
  profileId: string,
): Promise<ProposalInfo | null> {
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

// Channel the proposal detail query subscribes to. Like/follow mutations
// register it so engagement counts (likesCount, followersCount) refresh
// immediately on the proposal view. Deliberately scoped to the single
// proposal — invalidating the whole `decisionProposals` list channel for
// every like/follow would force every viewer to re-fetch every card.
function proposalRelationshipChannels({
  processInstanceId,
  proposalId,
}: ProposalInfo) {
  return [Channels.decisionProposal(processInstanceId, proposalId)];
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

// Confirmed tier (not closed-network): accounts claimed from public decision
// processes are deliberately outside the allowList, and like/follow is part of
// what a claimed account is promised. The walled garden still gates which
// profiles such users can reach in the first place.
const relationshipProcedure = authenticatedConfirmedProcedure({
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
