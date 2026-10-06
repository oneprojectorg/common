import { serializeDehydratedState } from '@op/api/dehydratedState';
import { createServerUtils, dehydrate } from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { PAGE_LIMIT } from '@op/common/client';
import { logger } from '@op/logging';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

/**
 * The home feed's first page, prefetched so the client renders it without a
 * second round trip. If the prefetch fails the client fetches instead.
 */
export const prefetchLandingFeed = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { utils, queryClient } = await createServerUtils();

    try {
      await utils.organization.listAllPosts.fetchInfinite({
        limit: PAGE_LIMIT.sm,
      });
    } catch (error) {
      logger.error('Homepage post prefetch failed', { error });
    }

    return serializeDehydratedState(dehydrate(queryClient));
  },
);

/** The newest organizations, or null when they can't be loaded. */
export const listNewOrganizations = createServerFn({ method: 'GET' })
  .validator(z.object({ limit: z.number() }))
  .handler(async ({ data }) => {
    try {
      const client = await createClient();
      const { items } = await client.organization.list({
        limit: data.limit,
        cursor: null,
        orderBy: 'createdAt',
      });

      return items;
    } catch {
      return null;
    }
  });
