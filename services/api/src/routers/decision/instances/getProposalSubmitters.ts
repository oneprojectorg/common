import { getProposalSubmitters } from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const getProposalSubmittersInputSchema = z.object({
  processInstanceId: z.uuid(),
});

const submitterSchema = z.object({
  slug: z.string(),
  name: z.string().nullable(),
  avatarImage: z
    .object({
      name: z.string(),
    })
    .nullable(),
});

const getProposalSubmittersOutputSchema = z.object({
  submitters: z.array(submitterSchema),
});

export const getProposalSubmittersRouter = router({
  getProposalSubmitters: commonAuthedProcedure()
    .input(getProposalSubmittersInputSchema)
    .output(getProposalSubmittersOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        return await getProposalSubmitters({
          input,
          user,
        });
      } catch (error: unknown) {
        logger.error('Failed to get proposal submitters', {
          userId: user.id,
          processInstanceId: input.processInstanceId,
          error,
        });

        throw new TRPCError({
          message: 'Failed to get proposal submitters',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
