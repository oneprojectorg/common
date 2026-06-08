import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHiveProvider } from './hive';

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

afterEach(() => vi.unstubAllGlobals());

describe('createHiveProvider', () => {
  it('normalizes 0-3 class scores into ModerationScores (score / 3)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({
        response: {
          output: [
            {
              classes: [
                { class: 'sexual', score: 3 },
                { class: 'hate', score: 0 },
                { class: 'violence', score: 1.5 },
                { class: 'bullying', score: 3 },
              ],
            },
          ],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const scores = await createHiveProvider({ apiKey: 'k' }).scoreText({
      content: 'hi',
    });

    expect(scores.sexual).toBeCloseTo(1);
    expect(scores.hate).toBeCloseTo(0);
    expect(scores.violence).toBeCloseTo(0.5);
    // bullying maps onto our `harassment` category
    expect(scores.harassment).toBeCloseTo(1);
  });

  it('sends the key as a `Token` authorization header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ response: { output: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    await createHiveProvider({ apiKey: 'secret-key' }).scoreText({
      content: 'hi',
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.authorization).toBe('Token secret-key');
  });

  it('throws on non-2xx without leaking the key or url', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createHiveProvider({
      apiKey: 'secret-key',
      apiUrl: 'https://secret.example/score',
    });

    const err = await provider.scoreText({ content: 'hi' }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String(err.message)).not.toContain('secret-key');
    expect(String(err.message)).not.toContain('secret.example');
  });

  it('returns empty scores when the response is malformed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ response: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const scores = await createHiveProvider({ apiKey: 'k' }).scoreText({
      content: 'hi',
    });

    expect(scores).toEqual({});
  });

  it('does not expose submitForReview (pure classifier, no record link)', () => {
    expect(createHiveProvider({ apiKey: 'k' }).submitForReview).toBeUndefined();
  });
});
