import { listProposalVersions } from '@op/common';
import { z } from 'zod';

import { proposalVersionListEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalVersionsRouter = router({
  listProposalVersions: commonAuthedProcedure()
    .input(
      z.object({
        proposalId: z.uuid(),
      }),
    )
    .output(proposalVersionListEncoder)
    .query(async ({ ctx, input }) => {
      const result = await listProposalVersions({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      return proposalVersionListEncoder.parse(result);
    }),
});
