import { deletePhase } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

export const deletePhaseRouter = router({
  deletePhase: authenticatedConfirmedProcedure()
    .input(z.object({ phaseId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deletePhase({ user: ctx.user, phaseId: input.phaseId });
    }),
});
