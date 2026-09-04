import {
  Channels,
  instancePhaseRefSchema,
  listReviewAssignmentLocations,
} from '@op/common';
import { proposalLocationsSchema } from '@op/common/client';
import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewAssignmentLocationsRouter = router({
  /**
   * Pins for the reviewer's "Proposals to review" map — every located proposal
   * the caller is assigned to review, so the map isn't capped by the queue's
   * page size. Same output shape as `listProposalLocations`, so the map view
   * consumes either read unchanged.
   */
  listReviewAssignmentLocations: networkAuthenticatedProcedure()
    .input(
      instancePhaseRefSchema.extend({
        /** Same filter the queue applies, so pins and cards agree. */
        status: z.enum(ProposalReviewAssignmentStatus).optional(),
      }),
    )
    .output(proposalLocationsSchema)
    .query(async ({ ctx, input }) => {
      // Same channel as the queue: assigning or removing an assignment has to
      // move the pins and the cards together.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      const result = await listReviewAssignmentLocations({
        processInstanceId: input.processInstanceId,
        phaseId: input.phaseId,
        status: input.status,
        user: ctx.user,
      });

      return proposalLocationsSchema.parse(result);
    }),
});
