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
        status: z
          .enum(['draft', 'submitted', 'under_review', 'approved', 'rejected'])
          .optional(),
        dir: z.enum(['asc', 'desc']),
        proposalFilter: z
          .enum(['all', 'my', 'shortlisted', 'my-ballot'])
          .optional(),
      }),
    }),
  },
} as const;
