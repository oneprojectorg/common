import { Channels } from '@op/common/realtime';
import { initTRPC } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { TContext } from '../types';
import withChannelMeta from './withChannelMeta';

vi.mock('@op/realtime/server', () => ({
  realtime: { publishMany: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}));

const CHANNELS = [Channels.reviewAssignment('a1')];

const t = initTRPC.context<TContext>().create();
const withChannels = t.procedure.use(withChannelMeta);

const router = t.router({
  read: withChannels
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      ctx.registerQueryChannels(CHANNELS);
      return { id: input.id };
    }),
  write: withChannels.mutation(({ ctx }) => {
    // Registered as a query on purpose: the hook must stay silent for a
    // mutation even when channels were collected.
    ctx.registerQueryChannels(CHANNELS);
    return { written: true };
  }),
});

function buildContext({
  isServerSideCall,
  onQueryChannels,
}: {
  isServerSideCall: boolean;
  onQueryChannels?: TContext['onQueryChannels'];
}): TContext {
  return {
    getCookies: () => ({}),
    getCookie: () => undefined,
    setCookie: () => {},
    registerMutationChannels: () => {},
    registerQueryChannels: () => {},
    onQueryChannels,
    requestId: 'test-request',
    time: Date.now(),
    ip: null,
    reqUrl: 'http://localhost/trpc',
    req: new Request('http://localhost/trpc'),
    isServerSideCall,
  };
}

describe('withChannelMeta', () => {
  it('reports a server-side query’s channels to onQueryChannels', async () => {
    const onQueryChannels = vi.fn();
    const caller = router.createCaller(
      buildContext({ isServerSideCall: true, onQueryChannels }),
    );

    const result = await caller.read({ id: 'p1' });

    // No envelope on a server-side call: the data reaches the caller as-is.
    expect(result).toEqual({ id: 'p1' });
    expect(onQueryChannels).toHaveBeenCalledTimes(1);
    expect(onQueryChannels).toHaveBeenCalledWith({
      path: 'read',
      input: { id: 'p1' },
      channels: CHANNELS,
    });
  });

  it('wraps the response over HTTP and leaves the hook alone', async () => {
    const onQueryChannels = vi.fn();
    const caller = router.createCaller(
      buildContext({ isServerSideCall: false, onQueryChannels }),
    );

    const result = await caller.read({ id: 'p1' });

    expect(result).toEqual({
      _data: { id: 'p1' },
      _meta: { channels: CHANNELS },
    });
    expect(onQueryChannels).not.toHaveBeenCalled();
  });

  it('does not report channels for a mutation', async () => {
    const onQueryChannels = vi.fn();
    const caller = router.createCaller(
      buildContext({ isServerSideCall: true, onQueryChannels }),
    );

    await caller.write();

    expect(onQueryChannels).not.toHaveBeenCalled();
  });
});
