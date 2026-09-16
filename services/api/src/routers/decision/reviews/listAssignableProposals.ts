import {
  Channels,
  instancePhaseRefSchema,
  listAssignableProposals,
} from '@op/common';
import {
  assignableProposalListSchema,
  proposalSearchSchema,
} from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';
import { paginationSchema } from '../../../utils';

export const listAssignableProposalsRouter = router({
  /**
   * One page of proposals an admin could assign to a reviewer in a phase, each
   * row carrying that reviewer's assignment state for the phase.
   */
  listAssignableProposals: networkAuthenticatedProcedure()
    .input(
      instancePhaseRefSchema
        .extend({
          reviewerProfileId: z.uuid(),
          search: proposalSearchSchema.optional(),
        })
        .merge(paginationSchema),
    )
    .output(assignableProposalListSchema)
    .query(async ({ ctx, input }) => {
      // Assignment writes publish here, so a save refreshes the pick list's
      // per-row state along with the queue.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listAssignableProposals({
        ...input,
        user: ctx.user,
      });
    }),
});
