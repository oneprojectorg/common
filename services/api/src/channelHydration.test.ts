import { Channels } from '@op/common/realtime';
import type { DehydratedState } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  createChannelRecords,
  decorateDehydratedState,
  recordQueryChannels,
} from './channelHydration';

const CHANNELS = [Channels.reviewAssignments('i1')];
const OTHER_CHANNELS = [Channels.reviewAssignments('i2')];

function buildQuery(queryKey: unknown): DehydratedState['queries'][number] {
  return {
    queryKey: Array.isArray(queryKey) ? queryKey : [],
    queryHash: JSON.stringify(queryKey),
    state: {
      data: null,
      dataUpdateCount: 1,
      dataUpdatedAt: 1,
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      status: 'success',
      fetchStatus: 'idle',
    },
  };
}

describe('channelHydration', () => {
  it('tags the query a record was written for and leaves the rest alone', () => {
    const records = createChannelRecords();
    recordQueryChannels(records, {
      path: 'decision.listReviewAssignments',
      input: { processInstanceId: 'i1' },
      channels: CHANNELS,
    });

    const state: DehydratedState = {
      mutations: [],
      queries: [
        buildQuery([
          ['decision', 'listReviewAssignments'],
          { input: { processInstanceId: 'i1' }, type: 'query' },
        ]),
        buildQuery([['decision', 'getProposal'], { type: 'query' }]),
      ],
    };

    const decorated = decorateDehydratedState(state, records);

    expect(decorated.queries[0]?.meta).toEqual({
      realtimeChannels: CHANNELS,
    });
    expect(decorated.queries[1]?.meta).toBeUndefined();
  });

  it('matches an infinite key against the raw input that carried a cursor', () => {
    const records = createChannelRecords();
    recordQueryChannels(records, {
      path: 'decision.listProposals',
      input: { processInstanceId: 'i1', cursor: 'c1', direction: 'forward' },
      channels: CHANNELS,
    });

    const state: DehydratedState = {
      mutations: [],
      queries: [
        buildQuery([
          ['decision', 'listProposals'],
          { input: { processInstanceId: 'i1' }, type: 'infinite' },
        ]),
      ],
    };

    const decorated = decorateDehydratedState(state, records);

    expect(decorated.queries[0]?.meta).toEqual({
      realtimeChannels: CHANNELS,
    });
  });

  it('matches an infinite key whose call carried no cursor', () => {
    const records = createChannelRecords();
    recordQueryChannels(records, {
      path: 'decision.listReviewerAssignments',
      input: { processInstanceId: 'i1' },
      channels: CHANNELS,
    });

    const state: DehydratedState = {
      mutations: [],
      queries: [
        buildQuery([
          ['decision', 'listReviewerAssignments'],
          { input: { processInstanceId: 'i1' }, type: 'infinite' },
        ]),
      ],
    };

    const decorated = decorateDehydratedState(state, records);

    expect(decorated.queries[0]?.meta).toEqual({
      realtimeChannels: CHANNELS,
    });
  });

  // `direction` is only pagination to an infinite query. A plain query may
  // carry it as an ordinary filter, and must not inherit the channels of a
  // sibling call that differs only there.
  it('keeps a plain query with a `direction` input on its own record', () => {
    const records = createChannelRecords();
    recordQueryChannels(records, {
      path: 'decision.listProposals',
      input: { processInstanceId: 'i1', direction: 'asc' },
      channels: CHANNELS,
    });
    recordQueryChannels(records, {
      path: 'decision.listProposals',
      input: { processInstanceId: 'i1', direction: 'desc' },
      channels: OTHER_CHANNELS,
    });

    const state: DehydratedState = {
      mutations: [],
      queries: [
        buildQuery([
          ['decision', 'listProposals'],
          {
            input: { processInstanceId: 'i1', direction: 'asc' },
            type: 'query',
          },
        ]),
        // Same procedure, no `direction` at all: only the stripped bucket
        // could match it, and a plain query never reads that bucket.
        buildQuery([
          ['decision', 'listProposals'],
          { input: { processInstanceId: 'i1' }, type: 'query' },
        ]),
      ],
    };

    const decorated = decorateDehydratedState(state, records);

    expect(decorated.queries[0]?.meta).toEqual({
      realtimeChannels: CHANNELS,
    });
    expect(decorated.queries[1]?.meta).toBeUndefined();
  });

  // Both spellings live in one request: the plain record must not be
  // overwritten by the infinite one's stripped record, or vice versa.
  it('keeps a plain and an infinite prefetch of one procedure apart', () => {
    const records = createChannelRecords();
    recordQueryChannels(records, {
      path: 'decision.listProposals',
      input: { pid: 'p1' },
      channels: CHANNELS,
    });
    recordQueryChannels(records, {
      path: 'decision.listProposals',
      input: { pid: 'p1', cursor: 'c1' },
      channels: OTHER_CHANNELS,
    });

    const state: DehydratedState = {
      mutations: [],
      queries: [
        buildQuery([
          ['decision', 'listProposals'],
          { input: { pid: 'p1' }, type: 'query' },
        ]),
        buildQuery([
          ['decision', 'listProposals'],
          { input: { pid: 'p1' }, type: 'infinite' },
        ]),
      ],
    };

    const decorated = decorateDehydratedState(state, records);

    expect(decorated.queries[0]?.meta).toEqual({
      realtimeChannels: CHANNELS,
    });
    expect(decorated.queries[1]?.meta).toEqual({
      realtimeChannels: OTHER_CHANNELS,
    });
  });

  it('matches a query that was called without input', () => {
    const records = createChannelRecords();
    recordQueryChannels(records, {
      path: 'decision.listMine',
      input: undefined,
      channels: CHANNELS,
    });

    const state: DehydratedState = {
      mutations: [],
      queries: [buildQuery([['decision', 'listMine'], { type: 'query' }])],
    };

    const decorated = decorateDehydratedState(state, records);

    expect(decorated.queries[0]?.meta).toEqual({
      realtimeChannels: CHANNELS,
    });
  });

  it('keeps meta already on the query', () => {
    const records = createChannelRecords();
    recordQueryChannels(records, {
      path: 'decision.listMine',
      input: undefined,
      channels: CHANNELS,
    });

    const query = buildQuery([['decision', 'listMine'], { type: 'query' }]);
    const state: DehydratedState = {
      mutations: [],
      queries: [{ ...query, meta: { existing: true } }],
    };

    const decorated = decorateDehydratedState(state, records);

    expect(decorated.queries[0]?.meta).toEqual({
      existing: true,
      realtimeChannels: CHANNELS,
    });
  });
});
