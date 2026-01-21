import { listProposals } from '@op/common';

import { proposalListEncoder } from '../../../encoders/decision';
import { legacyProposalFilterSchema } from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalsRouter = router({
  listProposals: commonAuthedProcedure()
    .input(legacyProposalFilterSchema)
    .output(proposalListEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const result = await listProposals({
        input: { ...input, authUserId: user.id },
        user,
      });

      return proposalListEncoder.parse(result);
    }),
});
