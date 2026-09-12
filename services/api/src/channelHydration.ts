import type { ChannelName } from '@op/common/realtime';
import { withRealtimeChannelsMeta } from '@op/common/realtime';
import type { DehydratedState } from '@tanstack/react-query';
import { hashKey } from '@tanstack/react-query';

/**
 * Channels recorded during one server render.
 *
 * Two buckets because tRPC keys the same procedure two ways: a plain query
 * caches under its input verbatim, an infinite one under the input with
 * `cursor`/`direction` removed. Looking a key up in the wrong bucket would
 * hand a query the channels of a sibling call that differs only by pagination,
 * so only a call that actually carried one of those fields writes a stripped
 * record. Residual: a plain call that itself carries `cursor`/`direction` and
 * an infinite call of the same procedure in one request still share the
 * stripped record, and the later one wins.
 */
export interface ChannelRecords {
  /** Keyed by the hash of the input the procedure was called with. */
  exact: Map<string, ChannelName[]>;
  /**
   * Keyed by the hash of that input minus `cursor` and `direction`, and only
   * for calls that carried at least one of them.
   */
  stripped: Map<string, ChannelName[]>;
}

/** @see https://trpc.io/docs/v11/getQueryKey */
type TRPCQueryKey = [
  readonly string[],
  { input?: unknown; type?: 'query' | 'infinite' }?,
];

export function createChannelRecords(): ChannelRecords {
  return { exact: new Map(), stripped: new Map() };
}

/**
 * Hash of `[splitPath, { input }]` — or `[splitPath]` when the call had no
 * input, which is the key tRPC builds in that case.
 */
export function channelRecordKey(
  path: string | readonly string[],
  input: unknown,
): string {
  const splitPath = typeof path === 'string' ? path.split('.') : path;
  return hashKey(input === undefined ? [splitPath] : [splitPath, { input }]);
}

/**
 * Record the channels a prefetched query resolved with. A later record for the
 * same key replaces the earlier one: the last resolution is the one the cache
 * holds.
 */
export function recordQueryChannels(
  records: ChannelRecords,
  {
    path,
    input,
    channels,
  }: { path: string; input: unknown; channels: ChannelName[] },
): void {
  records.exact.set(channelRecordKey(path, input), channels);

  const stripped = stripPagination(input);
  if (stripped !== undefined) {
    records.stripped.set(channelRecordKey(path, stripped), channels);
  }
}

/**
 * Copy the dehydrated state with each recorded query's channels written into
 * its `meta`, so the client boundary can register them without a round trip.
 * Queries with no record are returned untouched.
 */
export function decorateDehydratedState(
  state: DehydratedState,
  records: ChannelRecords,
): DehydratedState {
  if (records.exact.size === 0) {
    return state;
  }

  return {
    ...state,
    queries: state.queries.map((query) => {
      const trpcKey = asTRPCQueryKey(query.queryKey);
      if (!trpcKey) {
        return query;
      }

      const [splitPath, options] = trpcKey;
      const recordKey = channelRecordKey(splitPath, options?.input);
      // A plain key is the input verbatim, so it is matched exactly. An
      // infinite key had `cursor`/`direction` removed by tRPC, so it reads the
      // stripped bucket first, and falls back to `exact` for an infinite call
      // that carried neither and so wrote no stripped record.
      const channels =
        options?.type === 'infinite'
          ? (records.stripped.get(recordKey) ?? records.exact.get(recordKey))
          : records.exact.get(recordKey);

      if (!channels) {
        return query;
      }

      return { ...query, meta: withRealtimeChannelsMeta(query.meta, channels) };
    }),
  };
}

/**
 * Narrow a cache key to the shape tRPC caches under. Anything else in the
 * cache (a hand-rolled key, say) is left alone.
 */
function asTRPCQueryKey(queryKey: unknown): TRPCQueryKey | null {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    return null;
  }

  const [splitPath, options] = queryKey;
  if (
    !Array.isArray(splitPath) ||
    !splitPath.every((part) => typeof part === 'string')
  ) {
    return null;
  }

  if (options === undefined) {
    return [splitPath];
  }

  if (
    typeof options !== 'object' ||
    options === null ||
    Array.isArray(options)
  ) {
    return null;
  }

  const type = Reflect.get(options, 'type');
  if (type !== undefined && type !== 'query' && type !== 'infinite') {
    return null;
  }

  return [splitPath, { input: Reflect.get(options, 'input'), type }];
}

/**
 * The input with `cursor` and `direction` removed, or undefined when it
 * carried neither and there is no separate stripped spelling to record.
 */
function stripPagination(input: unknown): Record<string, unknown> | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return undefined;
  }

  const entries = Object.entries(input);
  if (!entries.some(([key]) => key === 'cursor' || key === 'direction')) {
    return undefined;
  }

  return Object.fromEntries(
    entries.filter(([key]) => key !== 'cursor' && key !== 'direction'),
  );
}
