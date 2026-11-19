import {
  Channels,
  listProposalSubmitters,
  proposalSubmittersListSchema,
} from '@op/common';
import { instanceOptionalPhaseRefSchema } from '@op/common/client';

import { openProcedure, router } from '../../../trpcFactory';

export const listProposalSubmittersRouter = router({
  listProposalSubmitters: openProcedure()
    .input(instanceOptionalPhaseRefSchema)
    .output(proposalSubmittersListSchema)
    .query(({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return listProposalSubmitters({ input, user: ctx.user });
    }),
});
