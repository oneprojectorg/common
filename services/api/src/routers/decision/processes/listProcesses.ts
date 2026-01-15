import { listProcesses } from '@op/common';

import {
  legacyDecisionProcessListEncoder,
  legacyProcessFilterSchema,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProcessesRouter = router({
  listProcesses: commonAuthedProcedure()
    .input(legacyProcessFilterSchema)
    .output(legacyDecisionProcessListEncoder)
    .query(async ({ input }) => {
      const result = await listProcesses(input);
      return legacyDecisionProcessListEncoder.parse({
        processes: result.processes.map((process) => ({
          ...process,
          processSchema: process.processSchema as Record<string, any>,
          createdBy: process.createdBy || undefined,
        })),
        total: result.total,
        hasMore: result.hasMore,
      });
    }),
});
