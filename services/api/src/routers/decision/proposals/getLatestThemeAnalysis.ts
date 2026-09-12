import {
  getLatestThemeAnalysis,
  latestThemeAnalysisResponseSchema,
  themeAnalysisScopeSchema,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const latestThemeAnalysisInputSchema = z.object({
  processInstanceId: z.string().uuid(),
  scope: themeAnalysisScopeSchema,
});

export const getLatestThemeAnalysisRouter = router({
  /**
   * The most recent stored theme analysis of a scope — what "View themes"
   * opens. Written by the scheduled refresh after the instance's proposals
   * change, and by a manual run when it finishes. Closed-network +
   * `decisions: ADMIN`, the same gate as starting a run.
   */
  getLatestThemeAnalysis: networkAuthenticatedProcedure()
    .input(latestThemeAnalysisInputSchema)
    .output(latestThemeAnalysisResponseSchema)
    .query(async ({ ctx, input }) => {
      // Both writers broadcast here after storing a snapshot, so a button that
      // says "Find themes" turns into "View themes" the moment the refresh
      // lands, and an open dialog learns its analysis has been superseded.
      ctx.registerQueryChannels([
        Channels.proposalThemeAnalysisLatest(
          input.processInstanceId,
          input.scope,
        ),
      ]);

      return await getLatestThemeAnalysis({
        processInstanceId: input.processInstanceId,
        scope: input.scope,
        user: ctx.user,
      });
    }),
});
