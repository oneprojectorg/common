import { Channels, queryChannelRegistry } from '@op/common/realtime';
import { QueryClient, hashKey } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { registerHydratedChannels } from './HydrationBoundary';

const CHANNEL = Channels.reviewAssignment('hydration-test');

const TAGGED_KEY = [['decision', 'listReviewAssignments'], { type: 'query' }];
const UNTAGGED_KEY = [['decision', 'getProposal'], { type: 'query' }];

function buildState(dataUpdatedAt: number) {
  return {
    queries: [
      {
        queryKey: TAGGED_KEY,
        queryHash: hashKey(TAGGED_KEY),
        state: { dataUpdatedAt },
        meta: { realtimeChannels: [CHANNEL] },
      },
      {
        queryKey: UNTAGGED_KEY,
        queryHash: hashKey(UNTAGGED_KEY),
        state: { dataUpdatedAt },
      },
    ],
  };
}

/** A live query in the cache whose data landed at `dataUpdatedAt`. */
function seedLiveQuery(queryClient: QueryClient, dataUpdatedAt: number) {
  queryClient.setQueryData(
    TAGGED_KEY,
    { seeded: true },
    { updatedAt: dataUpdatedAt },
  );
}

afterEach(() => {
  queryChannelRegistry.unregisterQuery({ queryKey: TAGGED_KEY });
  queryChannelRegistry.unregisterQuery({ queryKey: UNTAGGED_KEY });
});

describe('registerHydratedChannels', () => {
  it('registers a query that carries channels in its meta', () => {
    registerHydratedChannels(buildState(1_000), new QueryClient());

    expect(queryChannelRegistry.getQueryKeysForChannels([CHANNEL])).toEqual([
      TAGGED_KEY,
    ]);
  });

  it('registers when the incoming state is newer than the live query', () => {
    const queryClient = new QueryClient();
    seedLiveQuery(queryClient, 1_000);

    registerHydratedChannels(buildState(2_000), queryClient);

    expect(queryChannelRegistry.getQueryKeysForChannels([CHANNEL])).toEqual([
      TAGGED_KEY,
    ]);
  });

  it('registers when the incoming state is as old as the live query', () => {
    const queryClient = new QueryClient();
    seedLiveQuery(queryClient, 1_000);

    registerHydratedChannels(buildState(1_000), queryClient);

    expect(queryChannelRegistry.getQueryKeysForChannels([CHANNEL])).toEqual([
      TAGGED_KEY,
    ]);
  });

  // A late-arriving older boundary is ignored by `hydrate`, so its channels
  // must not replace what the live query registered with either.
  it('skips a query the live cache holds a newer version of', () => {
    const queryClient = new QueryClient();
    seedLiveQuery(queryClient, 2_000);

    registerHydratedChannels(buildState(1_000), queryClient);

    expect(queryChannelRegistry.getQueryKeysForChannels([CHANNEL])).toEqual([]);
  });

  it('ignores a state with no queries', () => {
    expect(() =>
      registerHydratedChannels(undefined, new QueryClient()),
    ).not.toThrow();
    expect(queryChannelRegistry.getQueryKeysForChannels([CHANNEL])).toEqual([]);
  });
});
