import { cache } from '@op/cache';
import {
  getProcessCategories,
  loadDecisionInstanceCategories,
} from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../../trpcFactory';

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

/**
 * Cache the viewer-independent portion of the categories lookup — the auth
 * scope + the resolved categories list. The access check is computed per
 * request and stays outside the cache. Invalidated alongside the instance
 * snapshot on any instance-level write.
 */
const cachedLoadDecisionInstanceCategories = (processInstanceId: string) =>
  cache({
    type: 'decision',
    params: [processInstanceId, 'categories'],
    fetch: () => loadDecisionInstanceCategories({ processInstanceId }),
  });

export const getCategoriesRouter = router({
  getCategories: openProcedure()
    .input(getCategoriesInputSchema)
    .output(getCategoriesOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const preloaded = await cachedLoadDecisionInstanceCategories(
        input.processInstanceId,
      );

      const categories = await getProcessCategories({
        processInstanceId: input.processInstanceId,
        user,
        preloaded,
      });

      return { categories };
    }),
});
