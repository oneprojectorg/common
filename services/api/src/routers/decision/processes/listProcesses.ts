import { listProcesses } from '@op/common';

import {
  decisionProcessWithSchemaListEncoder,
  processFilterSchema,
} from '../../../encoders/decision';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listProcessesRouter = router({
  listProcesses: networkAuthenticatedProcedure()
    .input(processFilterSchema)
    .output(decisionProcessWithSchemaListEncoder)
    .query(async ({ input }) => {
      const result = await listProcesses(input);
      return decisionProcessWithSchemaListEncoder.parse({
        processes: result.processes.map((process) => ({
          ...process,
          processSchema: process.processSchema,
          createdBy: process.createdBy || undefined,
        })),
        total: result.total,
        hasMore: result.hasMore,
      });
    }),
});
