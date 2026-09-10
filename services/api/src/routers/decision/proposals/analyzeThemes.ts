import { requestThemeAnalysis, themeAnalysisScopeSchema } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

// No filters, for the reason the export has none: what an analysis covers is
// fixed by the job rather than by whatever the requester happened to have on
// screen, so two facilitators analysing one instance are looking at the same
// corpus.
//
// `scope` is not a filter, it is which corpus. The proposals list shows the
// current phase and the results screen shows every proposal the instance has
// held; the two diverge once an instance advances, so the surface that launched
// the run has to say which one it meant. Defaulted to the phase, which is what
// every caller before the results screen meant.
const analyzeThemesInputSchema = z.object({
  processInstanceId: z.string().uuid(),
  scope: themeAnalysisScopeSchema.default('phase'),
});

const analyzeThemesOutputSchema = z.object({
  analysisId: z.string().uuid(),
});

export const analyzeProposalThemesRouter = router({
  analyzeThemes: networkAuthenticatedProcedure()
    .input(analyzeThemesInputSchema)
    .output(analyzeThemesOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      const { analysisId } = await requestThemeAnalysis({
        input: {
          processInstanceId: input.processInstanceId,
          scope: input.scope,
        },
        user,
      });

      logger.info('Theme analysis job created', {
        analysisId,
        userId: user.id,
        processInstanceId: input.processInstanceId,
        scope: input.scope,
      });

      return { analysisId };
    }),
});
