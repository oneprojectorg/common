import { SUPPORTED_LOCALES, translateProposal } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

/**
 * Generic output schema for all translation endpoints.
 * Returns a map of field names to translated text, plus locale metadata.
 */
export const translateOutput = z.object({
  translated: z.record(z.string(), z.string()),
  sourceLocale: z.string(),
  targetLocale: z.enum(SUPPORTED_LOCALES),
});

export const translateProposalRouter = router({
  translateProposal: commonAuthedProcedure()
    .input(
      z.object({
        profileId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(translateOutput)
    .mutation(async ({ input, ctx }) => {
      return translateProposal({
        profileId: input.profileId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});
