import { listProposals } from '@op/common';

import { proposalListSchema } from '@op/common/client';

import { proposalFilterSchema } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalsRouter = router({
  listProposals: commonAuthedProcedure()
    .input(proposalFilterSchema)
    .output(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const result = await listProposals({
        input: { ...input, authUserId: user.id },
        user,
      });

      return proposalListSchema.parse(result);
    }),
});
