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
  listAssignableProposals: networkAuthenticatedProcedure()
    .input(
      instancePhaseRefSchema
        .extend({
          reviewerProfileId: z.uuid(),
          search: proposalSearchSchema,
        })
        .merge(paginationSchema),
    )
    .output(assignableProposalListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listAssignableProposals({
        ...input,
        user: ctx.user,
      });
    }),
});
