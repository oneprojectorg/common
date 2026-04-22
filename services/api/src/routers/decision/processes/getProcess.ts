import { getProcess } from '@op/common';
import { z } from 'zod';

import { legacyDecisionProcessEncoder } from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

/** @deprecated Use the new decision system instead */
export const getProcessRouter = router({
  getProcess: commonAuthedProcedure()
    .input(z.object({ id: z.uuid() }))
    .output(legacyDecisionProcessEncoder)
    .query(async ({ input }) => {
      const process = await getProcess(input.id);
      return legacyDecisionProcessEncoder.parse(process);
    }),
});
