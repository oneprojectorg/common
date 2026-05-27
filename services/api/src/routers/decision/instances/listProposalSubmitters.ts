import {
  Channels,
  listProposalSubmitters,
  proposalSubmittersListSchema,
} from '@op/common';
import { z } from 'zod';

import { commonOpenProcedure, router } from '../../../trpcFactory';

const listProposalSubmittersInputSchema = z.object({
  processInstanceId: z.uuid(),
});

export const listProposalSubmittersRouter = router({
  listProposalSubmitters: commonOpenProcedure()
    .input(listProposalSubmittersInputSchema)
    .output(proposalSubmittersListSchema)
    .query(({ ctx, input }) => {
      const { user, accessUser } = ctx.authContext;
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return listProposalSubmitters({ input, user, accessUser });
    }),
});
