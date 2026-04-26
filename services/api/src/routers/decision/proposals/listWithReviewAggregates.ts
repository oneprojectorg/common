import {
  Channels,
  listProposalsWithReviewAggregates,
  proposalsWithReviewAggregatesListSchema,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const hydrationInput = z.object({
  processInstanceId: z.uuid(),
  proposalIds: z.array(z.uuid()).min(1).max(200),
});

const paginatedInput = z.object({
  processInstanceId: z.uuid(),
  categoryId: z.uuid().optional(),
  sortBy: z
    .enum(['createdAt', 'totalScore', 'averageScore', 'reviewsSubmitted'])
    .default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const listWithReviewAggregatesRouter = router({
  listWithReviewAggregates: commonAuthedProcedure()
    .input(z.union([hydrationInput, paginatedInput]))
    .output(proposalsWithReviewAggregatesListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listProposalsWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});
