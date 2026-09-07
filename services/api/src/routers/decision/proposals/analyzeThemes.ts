import { requestThemeAnalysis } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

// No filters, for the reason the export has none: what an analysis covers is
// fixed by the job — every non-draft proposal in the instance's current phase —
// rather than by whatever the requester happened to have on screen. Two
// facilitators analysing one instance are looking at the same corpus.
const analyzeThemesInputSchema = z.object({
  processInstanceId: z.string().uuid(),
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
        input: { processInstanceId: input.processInstanceId },
        user,
      });

      logger.info('Theme analysis job created', {
        analysisId,
        userId: user.id,
        processInstanceId: input.processInstanceId,
      });

      return { analysisId };
    }),
});
