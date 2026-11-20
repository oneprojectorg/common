import { Channels, getDevelopEntryLock } from '@op/common';
import {
  developEntryLockInputSchema,
  developEntryLockSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getDevelopEntryLockRouter = router({
  getDevelopEntryLock: networkAuthenticatedProcedure()
    .input(developEntryLockInputSchema)
    .output(developEntryLockSchema)
    .query(async ({ ctx, input }) => {
      const entryLock = await getDevelopEntryLock({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // The same channels as `getDevelopConfirmState`: confirm and unconfirm
      // publish on the proposals channel, a closed window on the instance one.
      const processInstanceId = entryLock.processInstanceId;
      ctx.registerQueryChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionInstance(processInstanceId),
      ]);

      return { lock: entryLock.lock };
    }),
});
