import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLassoProvider } from './lasso';

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

afterEach(() => vi.unstubAllGlobals());

describe('createLassoProvider', () => {
  it('treats an `allowed` verdict as a pass (no scores)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ success: true, status: 'allowed', actions: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const scores = await createLassoProvider({ apiToken: 't' }).scoreText({
      content: 'hi',
    });

    expect(scores).toEqual({});
  });

  it.each(['flagged', 'hidden'])(
    'treats a `%s` verdict as a decisive block score',
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(ok({ success: true, status, actions: [] }));
      vi.stubGlobal('fetch', fetchMock);

      const scores = await createLassoProvider({ apiToken: 't' }).scoreText({
        content: 'nope',
      });

      const total = Object.values(scores).reduce((a, b) => a + (b ?? 0), 0);
      expect(total).toBeGreaterThanOrEqual(1);
    },
  );

  it('sends the token as a Bearer authorization header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ success: true, status: 'allowed' }));
    vi.stubGlobal('fetch', fetchMock);

    await createLassoProvider({ apiToken: 'secret-token' }).scoreText({
      content: 'hi',
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.authorization).toBe('Bearer secret-token');
  });

  it('throws on non-2xx without leaking the token or url', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const err = await createLassoProvider({
      apiToken: 'secret-token',
      apiUrl: 'https://secret.example/content/sync',
    })
      .scoreText({ content: 'hi' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(String(err.message)).not.toContain('secret-token');
    expect(String(err.message)).not.toContain('secret.example');
  });

  it('submitForReview returns a dashboard reference with the content id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({
        success: true,
        status: 'flagged',
        actions: [{ content: { id: 'content-123' } }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const ref = await createLassoProvider({ apiToken: 't' }).submitForReview!({
      itemType: 'post',
      itemId: 'post-1',
      content: 'review me',
    });

    expect(ref.providerName).toBe('lasso');
    expect(ref.providerRecordId).toBe('content-123');
  });
});
