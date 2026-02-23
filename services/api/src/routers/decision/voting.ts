import { getVotingStatus, submitVote } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

// Input Schemas based on our contracts
const customDataSchema = z.record(z.string(), z.unknown()).optional();

const submitVoteInput = z.object({
  processInstanceId: z.uuid(),
  selectedProposalIds: z.array(z.uuid()).min(1),
  schemaVersion: z.string().optional(),
  customData: customDataSchema,
});

const votingProcedure = commonAuthedProcedure({
  rateLimit: { windowSize: 10, maxRequests: 5 },
});

export const votingRouter = router({
  // Submit user's vote (validates against current schema)
  submitVote: votingProcedure
    .input(submitVoteInput)
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
  getVotingStatus: votingProcedure
    .input(
      z.object({
        processInstanceId: z.uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return await getVotingStatus({
        data: {
          processInstanceId: input.processInstanceId,
          authUserId: ctx.user.id,
        },
        authUserId: ctx.user.id,
      });
    }),
});
