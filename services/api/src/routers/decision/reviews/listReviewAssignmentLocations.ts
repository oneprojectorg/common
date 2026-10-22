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
  /** Pins for the reviewer's map: every located proposal the caller is assigned to review. */
  listReviewAssignmentLocations: networkAuthenticatedProcedure()
    .input(
      instancePhaseRefSchema.extend({
        status: z.enum(ProposalReviewAssignmentStatus).optional(),
      }),
    )
    .output(proposalLocationsSchema)
    .query(async ({ ctx, input }) => {
      // Same channel as the queue so pins and cards invalidate together.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listReviewAssignmentLocations({
        processInstanceId: input.processInstanceId,
        phaseId: input.phaseId,
        status: input.status,
        user: ctx.user,
      });
    }),
});
