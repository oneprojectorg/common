import { getProposalIdsForPhase, listProposals } from '@op/common';

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

      const phaseProposalIds = await getProposalIdsForPhase({
        instanceId: input.processInstanceId,
      });

      const result = await listProposals({
        input: { ...input, authUserId: user.id, proposalIds: phaseProposalIds },
        user,
      });

      return proposalListEncoder.parse(result);
    }),
});
