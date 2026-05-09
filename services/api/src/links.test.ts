import { queryChannelRegistry } from '@op/common/realtime';
import { observable } from '@trpc/server/observable';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wrapResponseWithChannels } from './channelTransformer';
import { createChannelRegistrationLink } from './links';

/**
 * Drives a single operation through the channel-registration link and returns
 * the values seen by the downstream observer (i.e. what reaches the
 * application). The link is supposed to unwrap any `{ _data, _meta }` envelope
 * regardless of runtime.
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
  const link = createChannelRegistrationLink({ isServer })({} as never);

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
      expect((observed[0] as { result: { data: unknown } }).result.data).toEqual({
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
      const wrapped = wrapResponseWithChannels({ id: 'x' }, ['ch:x']);

      runLink({
        isServer: false,
        op: { type: 'query', path: 'thing.get', input: { id: 'x' } },
        emitted: wrapped,
      });

      expect(registerQuery).toHaveBeenCalledTimes(1);
      expect(registerQuery).toHaveBeenCalledWith(
        expect.objectContaining({ channels: ['ch:x'] }),
      );
    });

    it('does NOT touch the registry on the server', () => {
      const wrapped = wrapResponseWithChannels({ id: 'x' }, ['ch:x']);

      runLink({
        isServer: true,
        op: { type: 'query', path: 'thing.get', input: { id: 'x' } },
        emitted: wrapped,
      });

      expect(registerQuery).not.toHaveBeenCalled();
      expect(registerMutation).not.toHaveBeenCalled();
    });

    it('registers mutation channels on the client', () => {
      const wrapped = wrapResponseWithChannels(
        { ok: true },
        ['ch:invalidate'],
      );

      runLink({
        isServer: false,
        op: { type: 'mutation', path: 'thing.update' },
        emitted: wrapped,
      });

      expect(registerMutation).toHaveBeenCalledTimes(1);
      expect(registerMutation).toHaveBeenCalledWith(
        expect.objectContaining({ channels: ['ch:invalidate'] }),
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
