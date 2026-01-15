import { UnauthorizedError, getProcessCategories } from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const getCategoriesInputSchema = z.object({
  processInstanceId: z.uuid(),
});

const processCategoryEncoder = z.object({
  id: z.string(),
  name: z.string(),
  termUri: z.string(),
});

const getCategoriesOutputSchema = z.object({
  categories: z.array(processCategoryEncoder),
});

export const getCategoriesRouter = router({
  getCategories: commonAuthedProcedure()
    .input(getCategoriesInputSchema)
    .output(getCategoriesOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const categories = await getProcessCategories({
          processInstanceId: input.processInstanceId,
          authUserId: user.id,
          user,
        });

        return { categories };
      } catch (error: unknown) {
        logger.error('Failed to get process categories', {
          userId: user.id,
          processInstanceId: input.processInstanceId,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Failed to get process categories',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
