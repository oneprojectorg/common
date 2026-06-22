import { queryChannelRegistry } from '@op/common/realtime';
import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { observable } from '@trpc/server/observable';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wrapResponseWithChannels } from './channelTransformer';
import { createChannelRegistrationLink } from './links';

/**
 * Drives a single operation through the channel-registration link and returns
 * the values seen by the downstream observer (i.e. what reaches the
 * application). The link is supposed to unwrap any `{ _data, _meta }` envelope
 * regardless of runtime.
 *
 * `isServer` is simulated by toggling `globalThis.window`: vitest's node env
 * starts with no `window`, so the server case is the default; the client case
 * stubs an empty object. `vi.unstubAllGlobals()` in `afterEach` resets it.
 */
function runLink({
  isServer,
  op,
  emitted,
}: {
  isServer: boolean;
  op: { type: 'query' | 'mutation'; path: string; input?: unknown };
  emitted: unknown;
}): unknown[] {
  if (isServer) {
    vi.stubGlobal('window', undefined);
  } else {
    vi.stubGlobal('window', {});
  }

  const link = createChannelRegistrationLink()({} as never);

  const next = () =>
    observable<{ result: { data: unknown } }, unknown>((emit) => {
      emit.next({ result: { data: emitted } });
      emit.complete();
    });

  const observed: unknown[] = [];
  link({
    op: { ...op, id: 1, context: {} } as never,
    next: next as never,
  }).subscribe({
    next(v) {
      observed.push(v);
    },
  });

  return observed;
}

describe('createChannelRegistrationLink', () => {
  let registerQuery: ReturnType<typeof vi.spyOn>;
  let registerMutation: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registerQuery = vi
      .spyOn(queryChannelRegistry, 'registerQuery')
      .mockImplementation(() => {});
    registerMutation = vi
      .spyOn(queryChannelRegistry, 'registerMutation')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('unwrap symmetry — wrap on the wire MUST be unwrapped before the app sees it', () => {
    // This is the regression test for the SSR `_data/_meta` leak:
    // before the fix, the link skipped unwrap when isServer=true, so the
    // server-rendered tree saw `{ _data, _meta }` and crashed accessing
    // fields like `decisionProfile.processInstance`.
    it.each([
      ['client', false],
      ['server (SSR)', true],
    ] as const)('unwraps a wrapped envelope on %s', (_label, isServer) => {
      const wrapped = wrapResponseWithChannels(
        { processInstance: { id: 'abc', instanceData: { phases: [] } } },
        ['decisionInstance:abc'],
      );

      const observed = runLink({
        isServer,
        op: { type: 'query', path: 'decision.getDecisionBySlug' },
        emitted: wrapped,
      });

      expect(observed).toHaveLength(1);
      expect(
        (observed[0] as { result: { data: unknown } }).result.data,
      ).toEqual({
        processInstance: { id: 'abc', instanceData: { phases: [] } },
      });
    });

    it.each([
      ['client', false],
      ['server (SSR)', true],
    ] as const)(
      'passes non-wrapped data through unchanged on %s',
      (_label, isServer) => {
        const flat = { id: 'abc', name: 'Foo' };

        const observed = runLink({
          isServer,
          op: { type: 'query', path: 'profile.get' },
          emitted: flat,
        });

        expect(observed).toHaveLength(1);
        expect((observed[0] as { result: { data: unknown } }).result.data).toBe(
          flat,
        );
      },
    );
  });

  describe('channel registry is browser-only (would leak across requests on the server)', () => {
    it('registers query channels on the client', () => {
      const wrapped = wrapResponseWithChannels({ id: 'x' }, ['org:x']);

      runLink({
        isServer: false,
        op: { type: 'query', path: 'thing.get', input: { id: 'x' } },
        emitted: wrapped,
      });

      expect(registerQuery).toHaveBeenCalledTimes(1);
      expect(registerQuery).toHaveBeenCalledWith(
        expect.objectContaining({ channels: ['org:x'] }),
      );
    });

    it('does NOT touch the registry on the server', () => {
      const wrapped = wrapResponseWithChannels({ id: 'x' }, ['org:x']);

      runLink({
        isServer: true,
        op: { type: 'query', path: 'thing.get', input: { id: 'x' } },
        emitted: wrapped,
      });

      expect(registerQuery).not.toHaveBeenCalled();
      expect(registerMutation).not.toHaveBeenCalled();
    });

    it('registers mutation channels on the client', () => {
      const wrapped = wrapResponseWithChannels({ ok: true }, [
        'org:invalidate',
      ]);

      runLink({
        isServer: false,
        op: { type: 'mutation', path: 'thing.update' },
        emitted: wrapped,
      });

      expect(registerMutation).toHaveBeenCalledTimes(1);
      expect(registerMutation).toHaveBeenCalledWith(
        expect.objectContaining({ channels: ['org:invalidate'] }),
      );
    });
  });

  it('does not call the registry when the wrapped envelope has no channels', () => {
    const wrappedWithoutChannels = wrapResponseWithChannels({ id: 'x' }, []);

    runLink({
      isServer: false,
      op: { type: 'query', path: 'thing.get' },
      emitted: wrappedWithoutChannels,
    });

    expect(registerQuery).not.toHaveBeenCalled();
  });
});

// Uses a real `QueryClient` + the real registry so assertions run through React
// Query's actual partial-match logic.
describe('createChannelRegistrationLink — infinite query invalidation', () => {
  // tRPC caches `useSuspenseInfiniteQuery` under `type: 'infinite'`.
  function infiniteQueryKey(processInstanceId: string): QueryKey {
    return [
      ['decision', 'listProposals'],
      {
        input: { processInstanceId, dir: 'desc', limit: 51 },
        type: 'infinite',
      },
    ];
  }

  function seedInfiniteQuery(client: QueryClient, queryKey: QueryKey) {
    client.setQueryData(queryKey, {
      pages: [{ proposals: [], total: 0 }],
      pageParams: [undefined],
    });
  }

  // Wire input carries `cursor`/`direction` (tRPC infinite) that the cached key
  // strips — the registered key must strip them too to match.
  function registerListProposals(processInstanceId: string) {
    runLink({
      isServer: false,
      op: {
        type: 'query',
        path: 'decision.listProposals',
        input: {
          processInstanceId,
          dir: 'desc',
          limit: 51,
          cursor: 'page-2-cursor',
          direction: 'forward',
        },
      },
      emitted: wrapResponseWithChannels({ proposals: [], total: 0 }, [
        `decisionProposals:${processInstanceId}`,
      ]),
    });
  }

  it('invalidates a live infinite query via the local mutation path', async () => {
    registerListProposals('inst-local');

    const client = new QueryClient();
    const key = infiniteQueryKey('inst-local');
    seedInfiniteQuery(client, key);
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);

    // What QueryInvalidationSubscriber does on a `mutation:added` event.
    const keys = queryChannelRegistry.getQueryKeysForChannels([
      'decisionProposals:inst-local',
    ]);
    await Promise.all(
      keys.map((queryKey) => client.invalidateQueries({ queryKey })),
    );

    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it('invalidates a live infinite query via the realtime websocket path', async () => {
    registerListProposals('inst-ws');

    const client = new QueryClient();
    const key = infiniteQueryKey('inst-ws');
    seedInfiniteQuery(client, key);

    // The websocket handler runs the same registry lookup + invalidation.
    const keys = queryChannelRegistry.getQueryKeysForChannels([
      'decisionProposals:inst-ws',
    ]);
    await Promise.all(
      keys.map((queryKey) => client.invalidateQueries({ queryKey })),
    );

    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it('stays instance-scoped — does not over-invalidate other instances', async () => {
    registerListProposals('inst-a');

    const client = new QueryClient();
    const keyA = infiniteQueryKey('inst-a');
    const keyB = infiniteQueryKey('inst-b');
    seedInfiniteQuery(client, keyA);
    seedInfiniteQuery(client, keyB);

    const keys = queryChannelRegistry.getQueryKeysForChannels([
      'decisionProposals:inst-a',
    ]);
    await Promise.all(
      keys.map((queryKey) => client.invalidateQueries({ queryKey })),
    );

    expect(client.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  it('a `type: query` key does NOT match an infinite query', async () => {
    const client = new QueryClient();
    const key = infiniteQueryKey('inst-typed');
    seedInfiniteQuery(client, key);

    // Same input, but the `type` discriminator alone blocks the partial match.
    const typedKey = [
      ['decision', 'listProposals'],
      {
        input: { processInstanceId: 'inst-typed', dir: 'desc', limit: 51 },
        type: 'query',
      },
    ];
    await client.invalidateQueries({ queryKey: typedKey });

    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
