import {
  getThemeAnalysisStatus,
  themeAnalysisResponseSchema,
  themeAnalysisScopeSchema,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

// The instance and the scope are part of the cache key, not decoration: a run
// is stored under `themeAnalysis:<instance>:<scope>:<id>`, so an id alone does
// not name it. The client has both — it chose the scope when it started the run.
const themeAnalysisStatusInputSchema = z.object({
  analysisId: z.string().uuid(),
  processInstanceId: z.string().uuid(),
  scope: themeAnalysisScopeSchema,
});

export const getThemeAnalysisStatusRouter = router({
  getThemeAnalysisStatus: networkAuthenticatedProcedure()
    .input(themeAnalysisStatusInputSchema)
    .output(themeAnalysisResponseSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      // The workflow broadcasts here when it picks the job up and again when the
      // run settles, so a finished analysis surfaces without the client having
      // to ask again. Registered before the read: the run can settle while this
      // is in flight, and a channel attached to the response the client is
      // already waiting on is one it will subscribe to either way.
      ctx.registerQueryChannels([
        Channels.proposalThemeAnalysis(input.analysisId),
      ]);

      return await getThemeAnalysisStatus({
        analysisId: input.analysisId,
        processInstanceId: input.processInstanceId,
        scope: input.scope,
        user,
      });
    }),
});
