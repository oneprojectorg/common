import {
  listProposalSubmitters,
  proposalSubmittersListSchema,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const listProposalSubmittersInputSchema = z.object({
  processInstanceId: z.uuid(),
});

export const listProposalSubmittersRouter = router({
  listProposalSubmitters: commonAuthedProcedure()
    .input(listProposalSubmittersInputSchema)
    .output(proposalSubmittersListSchema)
    .query(({ ctx, input }) =>
      listProposalSubmitters({ input, user: ctx.user }),
    ),
});
