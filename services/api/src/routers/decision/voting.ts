import { getVotingStatus, submitVote } from '@op/common';
import { z } from 'zod';

import {
  networkAuthenticatedProcedure,
  openProcedure,
  router,
} from '../../trpcFactory';

// Input Schemas based on our contracts
const customDataSchema = z.record(z.string(), z.unknown()).optional();

const submitVoteInput = z.object({
  processInstanceId: z.uuid(),
  selectedProposalIds: z.array(z.uuid()).min(1),
  schemaVersion: z.string().optional(),
  customData: customDataSchema,
});

export const votingRouter = router({
  // Submit user's vote (validates against current schema)
  submitVote: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(submitVoteInput)
    .mutation(async ({ input, ctx }) => {
      // submitVote enqueues the `vote/submitted` event through the
      // transactional outbox, so we don't fire the notification from here —
      // the drainer cron publishes it after the submission row commits.
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

  // Get the caller's vote status with schema context. Open to public /
  // anonymous viewers of public decisions — they resolve to "not voted".
  getVotingStatus: openProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return await getVotingStatus({
        data: {
          processInstanceId: input.processInstanceId,
        },
        user: ctx.user,
      });
    }),
});
