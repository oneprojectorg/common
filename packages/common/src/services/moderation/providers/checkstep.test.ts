import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCheckstepProvider } from './checkstep';

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

afterEach(() => vi.unstubAllGlobals());

describe('createCheckstepProvider', () => {
  it('maps policy violations + severity into category scores', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({
        violations: [
          { policy: 'HTE', severity: 'high' },
          { policy: 'VIO', severity: 'low' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const scores = await createCheckstepProvider({ apiKey: 'k' }).scoreText({
      content: 'hi',
    });

    // HTE -> hate (high), VIO -> violence (low)
    expect(scores.hate).toBeGreaterThanOrEqual(scores.violence ?? 0);
    expect(scores.hate).toBeGreaterThan(0);
    expect(scores.violence).toBeGreaterThan(0);
  });

  it('passes (empty scores) when there are no violations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ violations: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const scores = await createCheckstepProvider({ apiKey: 'k' }).scoreText({
      content: 'hi',
    });

    expect(scores).toEqual({});
  });

  it('sends the key as a Bearer authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ violations: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await createCheckstepProvider({ apiKey: 'secret-key' }).scoreText({
      content: 'hi',
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.authorization).toBe('Bearer secret-key');
  });

  it('throws on non-2xx without leaking the key or url', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const err = await createCheckstepProvider({
      apiKey: 'secret-key',
      apiUrl: 'https://secret.example/api/v2',
    })
      .scoreText({ content: 'hi' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(String(err.message)).not.toContain('secret-key');
    expect(String(err.message)).not.toContain('secret.example');
  });

  it('submitForReview returns a dashboard reference with the content id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'cs-789' }));
    vi.stubGlobal('fetch', fetchMock);

    const ref = await createCheckstepProvider({
      apiKey: 'k',
    }).submitForReview!({
      subjectType: 'proposal',
      subjectId: 'prop-1',
      content: 'review me',
    });

    expect(ref.providerName).toBe('checkstep');
    expect(ref.providerRecordId).toBe('cs-789');
  });
});
