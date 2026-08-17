import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelName } from './channels';
import { queryChannelRegistry } from './queryChannelRegistry';

const CH_A = 'org:A' as ChannelName;
const CH_B = 'org:B' as ChannelName;

describe('queryChannelRegistry', () => {
  beforeEach(() => {
    // The registry is a module singleton; drain known query keys via the
    // public API so each test starts from a clean state.
    queryChannelRegistry.unregisterQuery({ queryKey: ['q1'] });
    queryChannelRegistry.unregisterQuery({ queryKey: ['q2'] });
    queryChannelRegistry.unregisterQuery({ queryKey: ['q3'] });
  });

  it('looks up query keys by channel after registration', () => {
    queryChannelRegistry.registerQuery({
      queryKey: ['q1'],
      channels: [CH_A],
    });

    expect(queryChannelRegistry.getQueryKeysForChannels([CH_A])).toEqual([
      ['q1'],
    ]);
  });

  it('emits channel:removed when the last query for a channel unregisters', () => {
    const onRemoved = vi.fn();
    const off = queryChannelRegistry.on('channel:removed', onRemoved);

    queryChannelRegistry.registerQuery({
      queryKey: ['q1'],
      channels: [CH_A],
    });
    queryChannelRegistry.unregisterQuery({ queryKey: ['q1'] });

    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(onRemoved).toHaveBeenCalledWith({ channel: CH_A });
    expect(queryChannelRegistry.getQueryKeysForChannels([CH_A])).toEqual([]);

    off();
  });

  it('keeps the channel alive while another query still references it', () => {
    const onRemoved = vi.fn();
    const off = queryChannelRegistry.on('channel:removed', onRemoved);

    queryChannelRegistry.registerQuery({
      queryKey: ['q1'],
      channels: [CH_A],
    });
    queryChannelRegistry.registerQuery({
      queryKey: ['q2'],
      channels: [CH_A],
    });

    queryChannelRegistry.unregisterQuery({ queryKey: ['q1'] });
    expect(onRemoved).not.toHaveBeenCalled();

    queryChannelRegistry.unregisterQuery({ queryKey: ['q2'] });
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(onRemoved).toHaveBeenCalledWith({ channel: CH_A });

    off();
  });

  it('decrements channels that a re-registration drops', () => {
    const onRemoved = vi.fn();
    const off = queryChannelRegistry.on('channel:removed', onRemoved);

    queryChannelRegistry.registerQuery({
      queryKey: ['q1'],
      channels: [CH_A, CH_B],
    });
    // Same query re-registers with a smaller channel set — B should drain.
    queryChannelRegistry.registerQuery({
      queryKey: ['q1'],
      channels: [CH_A],
    });

    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(onRemoved).toHaveBeenCalledWith({ channel: CH_B });
    expect(queryChannelRegistry.getQueryKeysForChannels([CH_A])).toEqual([
      ['q1'],
    ]);
    expect(queryChannelRegistry.getQueryKeysForChannels([CH_B])).toEqual([]);

    off();
  });

  it('unregister of an unknown query is a no-op', () => {
    const onRemoved = vi.fn();
    const off = queryChannelRegistry.on('channel:removed', onRemoved);

    queryChannelRegistry.unregisterQuery({ queryKey: ['never-registered'] });
    expect(onRemoved).not.toHaveBeenCalled();

    off();
  });

  it('mutation:added still fires with the registered channels', () => {
    const onMutation = vi.fn();
    const off = queryChannelRegistry.on('mutation:added', onMutation);

    queryChannelRegistry.registerMutation({
      channels: [CH_A],
      mutationId: 'm1',
    });

    expect(onMutation).toHaveBeenCalledWith({
      channels: [CH_A],
      mutationId: 'm1',
    });

    off();
  });

  // Consumers waiting on a background job re-read when their channel goes live,
  // because a broadcast published before the socket join is never delivered.
  it('channel:subscribed reports the channel whose join completed', () => {
    const onSubscribed = vi.fn();
    const off = queryChannelRegistry.on('channel:subscribed', onSubscribed);

    queryChannelRegistry.notifyChannelSubscribed(CH_A);

    expect(onSubscribed).toHaveBeenCalledWith({ channel: CH_A });

    off();
  });

  // A listener that kept firing after teardown would re-read on behalf of a
  // component that has gone away.
  it('stops delivering channel:subscribed once unsubscribed', () => {
    const onSubscribed = vi.fn();
    const off = queryChannelRegistry.on('channel:subscribed', onSubscribed);

    off();
    queryChannelRegistry.notifyChannelSubscribed(CH_A);

    expect(onSubscribed).not.toHaveBeenCalled();
  });
});
