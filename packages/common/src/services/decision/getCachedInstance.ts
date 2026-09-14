import { cache } from '@op/cache';
import { db } from '@op/db/client';

/**
 * The `processInstances` row every decision read shares, cached under the
 * `[instanceId, 'instance']` key that `invalidateDecisionInstance` drops.
 *
 * Go through this rather than issuing a narrower read of the same key: the
 * payload is whatever the first caller to miss stores, so a two-column fetch
 * cached here would starve `getInstance` of `process`, `owner`, `steward` and
 * the proposal list. A caller needing other columns widens this fetch; it does
 * not fork the key.
 *
 * The row is viewer-independent — every caller still runs its own access check
 * outside the cache, so a hit can't bypass authorization.
 *
 * skipMemCache, as with `getDecisionBySlug`'s snapshot: writers run in the API
 * process and `invalidateDecisionInstance` can only clear that process's local
 * LRU plus Redis. The app server reads this key in-process to seed /current,
 * so a local copy there would render the pre-mutation phase for the LRU's full
 * TTL after an admin advances. Redis is the layer the invalidate reaches.
 */
export const getCachedInstance = (instanceId: string) =>
  cache({
    type: 'decision',
    params: [instanceId, 'instance'],
    fetch: () =>
      db.query.processInstances.findFirst({
        where: { id: instanceId },
        with: {
          process: true,
          owner: true,
          steward: true,
          profile: {
            columns: {
              slug: true,
            },
          },
          proposals: {
            columns: {
              id: true,
              status: true,
              submittedByProfileId: true,
            },
          },
        },
      }),
    options: {
      skipMemCache: true,
    },
  });
