import { ProposalFilter } from '@op/core';
import { ProposalStatus } from '@op/db/schema';
import { z } from 'zod';

export const Events = {
  postReactionAdded: {
    name: 'post/reaction-added' as const,
    schema: z.object({
      sourceProfileId: z.string(),
      postId: z.string(),
      reactionType: z.string(),
    }),
  },
  proposalExportRequested: {
    name: 'proposal/export-requested' as const,
    schema: z.object({
      exportId: z.string().uuid(),
      processInstanceId: z.string().uuid(),
      userId: z.string().uuid(),
      format: z.enum(['csv']),
      filters: z.object({
        categoryId: z.string().optional(),
        submittedByProfileId: z.string().optional(),
        status: z.enum(ProposalStatus).optional(),
        dir: z.enum(['asc', 'desc']),
        proposalFilter: z.enum(ProposalFilter).optional(),
      }),
    }),
  },
  profileInviteRoleChanged: {
    name: 'profile/invite-role-changed' as const,
    schema: z.object({
      email: z.string().email(),
      newRoleName: z.string(),
      profileName: z.string(),
    }),
  },
  profileInviteSent: {
    name: 'profile/invites-sent' as const,
    schema: z.object({
      senderProfileId: z.string(),
      invitations: z.array(
        z.object({
          email: z.string().email(),
          inviterName: z.string(),
          profileName: z.string(),
          inviteUrl: z.string().url(),
          personalMessage: z.string().optional(),
        }),
      ),
    }),
  },
} as const;
