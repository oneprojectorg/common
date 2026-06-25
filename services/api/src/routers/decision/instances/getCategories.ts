import { cache } from '@op/cache';
import { getProcessCategories } from '@op/common';
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

// Categories embed the per-caller access check (unauthorized callers throw),
// so the cache key has to include the caller — see `getInstance` for the same
// trade-off. Invalidated on instance writes alongside the instance cache.
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;
const callerKey = (userId: string | undefined) => userId ?? 'anon';

export const getCategoriesRouter = router({
  getCategories: openProcedure()
    .input(getCategoriesInputSchema)
    .output(getCategoriesOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const categories = await cache({
        type: 'decision',
        params: [input.processInstanceId, callerKey(user?.id), 'categories'],
        fetch: () =>
          getProcessCategories({
            processInstanceId: input.processInstanceId,
            user,
          }),
        options: { ttl: CATEGORIES_CACHE_TTL_MS },
      });

      return { categories };
    }),
});
