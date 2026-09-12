import type { ChannelName } from './channels';

/** The React Query `meta` key that carries a query's realtime channels. */
const REALTIME_CHANNELS_META_KEY = 'realtimeChannels';

/**
 * A server prefetch cannot reach the client's channel registry directly, so the
 * channels a query resolved with ride along in the query's React Query `meta`:
 * `dehydrate` keeps `meta`, and the client boundary reads it back on hydration.
 */
export function withRealtimeChannelsMeta(
  meta: Record<string, unknown> | undefined,
  channels: ChannelName[],
): Record<string, unknown> {
  return { ...meta, [REALTIME_CHANNELS_META_KEY]: channels };
}

/**
 * Read the channels off a query's `meta`, tolerating anything else. Meta can
 * come from a persisted cache written by an older build, so every level is
 * checked rather than trusted.
 */
export function readRealtimeChannelsMeta(meta: unknown): ChannelName[] {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    return [];
  }

  const channels = Reflect.get(meta, REALTIME_CHANNELS_META_KEY);
  if (!isChannelNameArray(channels)) {
    return [];
  }

  return channels;
}

/**
 * `ChannelName` is a union of template-literal strings. Meta read back from a
 * cache is untyped, so narrow on the runtime shape we depend on — an array of
 * strings — rather than asserting the union.
 */
function isChannelNameArray(value: unknown): value is ChannelName[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}
