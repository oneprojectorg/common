import {
  getVotingStatus,
  submitVote,
  validateVoteSelectionService,
} from '@op/common';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

// Input Schemas based on our contracts
const customDataSchema = z.record(z.string(), z.unknown()).optional();

const submitVoteInput = z.object({
  processInstanceId: z.uuid(),
  selectedProposalIds: z.array(z.uuid()).min(1),
  schemaVersion: z.string().optional(),
  customData: customDataSchema,
});

const getVoteStatusInput = z.object({
  processInstanceId: z.uuid(),
  userId: z.uuid(),
});

const validateVoteSelectionInput = z.object({
  processInstanceId: z.uuid(),
  selectedProposalIds: z.array(z.uuid()),
});

export const votingRouter = router({
  // Submit user's vote (validates against current schema)
  submitVote: loggedProcedure
    .input(submitVoteInput)
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .mutation(async ({ input, ctx }) => {
      return await submitVote({
        data: {
          processInstanceId: input.processInstanceId,
          selectedProposalIds: input.selectedProposalIds,
          schemaVersion: input.schemaVersion,
          customData: input.customData,
          authUserId: ctx.user.id,
        },
        authUserId: ctx.user.id,
      });
    }),

  // Get user's vote status with schema context
  getVotingStatus: loggedProcedure
    .input(getVoteStatusInput)
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .query(async ({ input, ctx }) => {
      return await getVotingStatus({
        data: {
          processInstanceId: input.processInstanceId,
          userId: input.userId,
          authUserId: ctx.user.id,
        },
        authUserId: ctx.user.id,
      });
    }),

  // Validate vote selection against current schema
  validateVoteSelection: loggedProcedure
    .input(validateVoteSelectionInput)
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .query(async ({ input, ctx }) => {
      return await validateVoteSelectionService({
        data: {
          processInstanceId: input.processInstanceId,
          selectedProposalIds: input.selectedProposalIds,
          authUserId: ctx.user.id,
        },
        authUserId: ctx.user.id,
      });
    }),
});
