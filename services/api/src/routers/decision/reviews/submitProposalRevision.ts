import {
  getProposalRevisionChannels,
  submitProposalRevision,
} from '@op/common';
import { proposalReviewRequestListSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const submitProposalRevisionRouter = router({
  submitProposalRevision: networkAuthenticatedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
        note: z.string().trim().min(1),
      }),
    )
    .output(proposalReviewRequestListSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await submitProposalRevision({
        proposalId: input.proposalId,
        note: input.note,
        user: ctx.user,
      });

      ctx.registerMutationChannels(
        await getProposalRevisionChannels({
          processInstanceId: result.processInstanceId,
          proposalId: input.proposalId,
        }),
      );

      waitUntil(
        inngest.send({
          name: Events.reviewProposalRevisionSubmitted.name,
          data: {
            proposalId: input.proposalId,
            proposalHistoryId: result.proposalHistoryId,
            revisionRequestIds: result.items.map((request) => request.id),
          },
        }),
      );

      return proposalReviewRequestListSchema.parse({ items: result.items });
    }),
});
