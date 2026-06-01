import {
  Channels,
  listProposalSubmitters,
  proposalSubmittersListSchema,
} from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

const listProposalSubmittersInputSchema = z.object({
  processInstanceId: z.uuid(),
});

export const listProposalSubmittersRouter = router({
  listProposalSubmitters: commonNetworkProcedure()
    .input(listProposalSubmittersInputSchema)
    .output(proposalSubmittersListSchema)
    .query(({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return listProposalSubmitters({ input, user: ctx.user });
    }),
});
