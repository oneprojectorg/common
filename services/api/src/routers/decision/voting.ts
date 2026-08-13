import { Channels, getVotingStatus, submitVote } from '@op/common';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
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
      const result = await submitVote({
        data: {
          processInstanceId: input.processInstanceId,
          selectedProposalIds: input.selectedProposalIds,
          schemaVersion: input.schemaVersion,
          customData: input.customData,
          authUserId: ctx.user.id,
        },
        authUserId: ctx.user.id,
      });

      // The roster of who has voted just changed. Scoped to its own channel so
      // a vote doesn't invalidate every other decisionInstance query.
      ctx.registerMutationChannels([
        Channels.decisionVoters(input.processInstanceId),
      ]);

      // Send vote submitted event for notification workflow
      waitUntil(
        inngest.send({
          name: Events.voteSubmitted.name,
          data: {
            voteSubmissionId: result.id,
            processInstanceId: result.processInstanceId,
          },
        }),
      );

      return result;
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
