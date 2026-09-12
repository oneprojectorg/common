import { describe, expect, it } from 'vitest';

import { Channels } from './channels';
import {
  readRealtimeChannelsMeta,
  withRealtimeChannelsMeta,
} from './queryMeta';

const CH_A = Channels.org('A');

describe('realtime channel meta', () => {
  it('round-trips channels through meta and keeps other keys', () => {
    const meta = withRealtimeChannelsMeta({ other: 1 }, [CH_A]);

    expect(meta).toEqual({ other: 1, realtimeChannels: [CH_A] });
    expect(readRealtimeChannelsMeta(meta)).toEqual([CH_A]);
  });

  // Meta can come from a cache a previous release wrote, so anything that is
  // not an array of strings reads as "no channels" rather than throwing.
  it.each([
    ['undefined meta', undefined],
    ['a non-object', 'realtimeChannels'],
    ['meta without the key', { other: 1 }],
    ['a non-array value', { realtimeChannels: 'org:A' }],
    ['an array with a non-string', { realtimeChannels: ['org:A', 7] }],
  ])('reads no channels from %s', (_label, meta) => {
    expect(readRealtimeChannelsMeta(meta)).toEqual([]);
  });
});
