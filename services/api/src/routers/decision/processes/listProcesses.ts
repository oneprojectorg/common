import { listProcesses } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  decisionProcessListEncoder,
  processFilterSchema,
} from '../../../encoders/legacyDecision';
import { loggedProcedure, router } from '../../../trpcFactory';

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
  listProcesses: loggedProcedure
    .meta(meta)
    .input(processFilterSchema)
    .output(decisionProcessListEncoder)
    .query(async ({ input }) => {
      const result = await listProcesses(input);
      return decisionProcessListEncoder.parse({
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
