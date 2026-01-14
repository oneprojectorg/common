import { listProcesses } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  legacyDecisionProcessListEncoder,
  legacyProcessFilterSchema,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/processes',
    protect: true,
    tags: ['decision'],
    summary: 'List decision processes',
  },
};

export const listProcessesRouter = router({
  listProcesses: commonAuthedProcedure()
    .meta(meta)
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
