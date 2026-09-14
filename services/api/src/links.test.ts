import { queryChannelRegistry } from '@op/common/realtime';
import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { createTRPCClient, httpLink } from '@trpc/client';
import { createTRPCReact, getQueryKey } from '@trpc/react-query';
import { observable } from '@trpc/server/observable';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wrapResponseWithChannels } from './channelTransformer';
import { createChannelRegistrationLink } from './links';
import type { AppRouter } from './routers';

// `buildChannelQueryKey` in `links.ts` hand-mirrors tRPC's internal key shape,
// which drifts silently: nothing throws, queries simply stop being invalidated.
// Deriving the fixtures below from tRPC's own `getQueryKey` turns that silent
// drift into a failing test.
const trpcForKeys = createTRPCReact<AppRouter>();

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
  // tRPC caches `useSuspenseInfiniteQuery` under `type: 'infinite'`. Ask the
  // library for the key rather than writing it out, so a shape change in tRPC
  // fails here instead of quietly breaking realtime invalidation.
  function infiniteQueryKey(processInstanceId: string): QueryKey {
    return getQueryKey(
      trpcForKeys.decision.listProposals,
      { processInstanceId, dir: 'desc', limit: 51 },
      'infinite',
    );
  }

  function seedInfiniteQuery(client: QueryClient, queryKey: QueryKey) {
    client.setQueryData(queryKey, {
      pages: [{ items: [], total: 0 }],
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

  // `buildChannelQueryKey` drops `cursor`/`direction` because tRPC does. If
  // tRPC stopped, the registered key would carry a cursor and match nothing.
  it('tRPC still strips cursor and direction from an infinite query key', () => {
    // The wire input carries the pagination keys tRPC's infinite link adds;
    // they are not part of the procedure's declared input, so the object is
    // built first rather than passed as a fresh literal.
    const paginatedInput = {
      processInstanceId: 'inst-key-shape',
      dir: 'desc' as const,
      limit: 51,
      cursor: 'page-2-cursor',
      direction: 'forward' as const,
    };

    const withPagination = getQueryKey(
      trpcForKeys.decision.listProposals,
      paginatedInput,
      'infinite',
    );

    expect(withPagination).toEqual(infiniteQueryKey('inst-key-shape'));
  });

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

/**
 * The migration from `@trpc/react-query` to `@trpc/tanstack-react-query` runs
 * both clients against one `QueryClient`. That is only safe while they cache
 * under identical keys, and while `buildChannelQueryKey` — which the
 * channel-registration link builds by hand from `op.path`/`op.input` — still
 * partial-matches those keys.
 *
 * `getQueryKeyInternal` in `@trpc/tanstack-react-query` ends with
 * `if (opts.prefix) key.unshift([opts.prefix])`. A configured `keyPrefix`
 * therefore prepends a third element that the link cannot know about, and
 * realtime invalidation stops matching with no error anywhere. These tests are
 * the only thing that would catch it.
 */
describe('query keys — classic and tanstack clients must agree (no keyPrefix)', () => {
  // Never invoked: the options proxy derives keys without touching the client.
  const optionsProxy = createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({
      links: [
        httpLink({ url: 'http://localhost/trpc', transformer: superjson }),
      ],
    }),
    queryClient: new QueryClient(),
  });

  const input = {
    processInstanceId: 'inst-key-parity',
    dir: 'desc',
    limit: 51,
  } as const;

  it('produces the same plain-query key as the classic client', () => {
    expect(optionsProxy.decision.listProposals.queryKey(input)).toEqual(
      getQueryKey(trpcForKeys.decision.listProposals, input, 'query'),
    );
  });

  it('produces the same infinite-query key as the classic client', () => {
    expect(optionsProxy.decision.listProposals.infiniteQueryKey(input)).toEqual(
      getQueryKey(trpcForKeys.decision.listProposals, input, 'infinite'),
    );
  });

  // The prefix lands at index 0, so a key whose first element is the split
  // path is proof that no prefix is configured.
  it.each(['queryKey', 'infiniteQueryKey'] as const)(
    'leaves the split path at index 0 — no prefix element (%s)',
    (method) => {
      const key: QueryKey = optionsProxy.decision.listProposals[method](input);

      expect(key[0]).toEqual(['decision', 'listProposals']);
      expect(key).toHaveLength(2);
    },
  );

  /**
   * End-to-end proof, not a shape comparison: drive a real operation through
   * the link, then invalidate with the keys the registry hands back and assert
   * the entry the new client would have cached is the one that goes stale.
   */
  it.each([
    ['plain query', 'queryKey'],
    ['infinite query', 'infiniteQueryKey'],
  ] as const)(
    "the link-registered key invalidates the new client's %s entry",
    async (_label, method) => {
      const channel = `decisionProposals:${input.processInstanceId}` as const;

      runLink({
        isServer: false,
        op: {
          type: 'query',
          path: 'decision.listProposals',
          // Wire input carries the pagination keys tRPC strips from the key.
          input: { ...input, cursor: 'page-2', direction: 'forward' },
        },
        emitted: wrapResponseWithChannels({ items: [] }, [channel]),
      });

      const client = new QueryClient();
      // Widened: only the key's shape matters here, not the payload's type.
      const key: QueryKey = optionsProxy.decision.listProposals[method](input);
      client.setQueryData(key, { items: [] });
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);

      const keys = queryChannelRegistry.getQueryKeysForChannels([channel]);
      await Promise.all(
        keys.map((queryKey) => client.invalidateQueries({ queryKey })),
      );

      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    },
  );
});
