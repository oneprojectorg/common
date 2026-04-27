import {
  Channels,
  hydrateProposalsWithReviewAggregates,
  listProposalsWithReviewAggregates,
  proposalsWithReviewAggregatesListSchema,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const hydrationInput = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.string().optional(),
  proposalIds: z.array(z.uuid()).min(1).max(200),
});

const paginatedInput = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.string().optional(),
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

      if ('proposalIds' in input) {
        return await hydrateProposalsWithReviewAggregates({
          ...input,
          user: ctx.user,
        });
      }

      return await listProposalsWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});
