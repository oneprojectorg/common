import { getProposalsForPhase, listProposals } from '@op/common';

import {
  proposalFilterSchema,
  proposalListEncoder,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalsRouter = router({
  listProposals: commonAuthedProcedure()
    .input(proposalFilterSchema)
    .output(proposalListEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const phaseProposals = await getProposalsForPhase({
        instanceId: input.processInstanceId,
      });

      if (phaseProposals.length === 0) {
        return proposalListEncoder.parse({
          proposals: [],
          total: 0,
          hasMore: false,
          canManageProposals: false,
        });
      }

      const phaseProposalIds = phaseProposals.map((p) => p.id);

      const result = await listProposals({
        input: { ...input, authUserId: user.id, proposalIds: phaseProposalIds },
        user,
      });

      return proposalListEncoder.parse(result);
    }),
});
