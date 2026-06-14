import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHiveProvider } from './hive';

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

afterEach(() => vi.unstubAllGlobals());

const ROUND_ID = '99999999-9999-4999-8999-999999999999';

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

  it('maps spam and promotions classes onto the `other` category', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok({
        response: {
          output: [
            {
              classes: [
                { class: 'spam', score: 3 },
                { class: 'promotions', score: 1.5 },
              ],
            },
          ],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const scores = await createHiveProvider({ apiKey: 'k' }).scoreText({
      content: 'buy now',
    });

    // Both fold into `other`; the stronger (spam, 3/3) wins.
    expect(scores.other).toBeCloseTo(1);
  });

  it('chunks content over 1024 chars and keeps the worst score per category', async () => {
    const score = (value: number) => ({
      response: { output: [{ classes: [{ class: 'hate', score: value }] }] },
    });
    // First chunk scores low, second scores high; the high score must win.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok(score(1)))
      .mockResolvedValueOnce(ok(score(3)));
    vi.stubGlobal('fetch', fetchMock);

    const content = `${'a'.repeat(1100)} ${'b'.repeat(50)}`;
    const scores = await createHiveProvider({ apiKey: 'k' }).scoreText({
      content,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(scores.hate).toBeCloseTo(1); // max(1/3, 3/3)
  });

  it('submitForReview posts text and each media url as separate async tasks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ task_id: 'hive-task-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const ref = await createHiveProvider({ apiKey: 'k' }).submitForReview!({
      itemType: 'post',
      itemId: '11111111-1111-4111-8111-111111111111',
      roundId: ROUND_ID,
      content: 'hello',
      media: [{ url: 'https://cdn/a.png', kind: 'image' }],
      callbackUrl: 'https://us/webhook',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const textBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(textBody.get('post_id')).toBe(
      `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
    );
    expect(textBody.get('text_data')).toBe('hello');
    expect(textBody.get('callback_url')).toBe('https://us/webhook');
    const mediaBody = fetchMock.mock.calls[1][1].body as URLSearchParams;
    expect(mediaBody.get('post_id')).toBe(
      `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}:0`,
    );
    expect(mediaBody.get('url')).toBe('https://cdn/a.png');
    expect(ref.providerRecordId).toBe('hive-task-1');
  });

  it('planReviewRefs matches the refs submitForReview creates (text + each media)', () => {
    const provider = createHiveProvider({ apiKey: 'k' });

    expect(
      provider.planReviewRefs!({
        itemType: 'post',
        itemId: '11111111-1111-4111-8111-111111111111',
        roundId: ROUND_ID,
        content: 'hello',
        media: [
          { url: 'https://cdn/a.png', kind: 'image' },
          { url: 'https://cdn/b.png', kind: 'image' },
        ],
      }),
    ).toEqual([
      `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
      `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}:0`,
      `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}:1`,
    ]);

    // Whitespace-only text creates no text task; no media → empty plan.
    expect(
      provider.planReviewRefs!({
        itemType: 'user',
        itemId: '11111111-1111-4111-8111-111111111111',
        roundId: ROUND_ID,
        content: '   ',
      }),
    ).toEqual([]);
  });

  it('parseWebhook maps triggered rules to a flagged verdict for our item', () => {
    const [verdict] = createHiveProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        post_id: `proposal:55555555-5555-4555-8555-555555555555:${ROUND_ID}`,
        task_id: 'task-77',
        triggered_rules: [{ rule_id: 'r1', rule_name: 'Deny list' }],
      }),
      headers: {},
    });

    expect(verdict).toMatchObject({
      itemType: 'proposal',
      itemId: '55555555-5555-4555-8555-555555555555',
      roundId: ROUND_ID,
      verdict: 'flagged',
      externalRecordId: 'task-77',
      reason: 'Deny list',
    });
  });

  it('parseWebhook maps no triggered rules to a clear verdict', () => {
    const [verdict] = createHiveProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        post_id: `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
        task_id: 't',
        triggered_rules: [],
      }),
      headers: {},
    });

    expect(verdict?.verdict).toBe('clear');
  });

  it('parseWebhook throws on a payload missing post_id', () => {
    expect(() =>
      createHiveProvider({ apiKey: 'k' }).parseWebhook!({
        rawBody: JSON.stringify({ triggered_rules: [] }),
        headers: {},
      }),
    ).toThrow();
  });
});
