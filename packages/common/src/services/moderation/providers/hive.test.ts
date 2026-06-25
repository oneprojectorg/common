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

  it('submitForReview sends the default publisher id as user_id, overridable via config', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ task_id: 't' }));
    vi.stubGlobal('fetch', fetchMock);

    const submit = (provider: ReturnType<typeof createHiveProvider>) =>
      provider.submitForReview!({
        itemType: 'post',
        itemId: '11111111-1111-4111-8111-111111111111',
        roundId: ROUND_ID,
        content: 'hello',
        callbackUrl: 'https://us/webhook',
      });

    await submit(createHiveProvider({ apiKey: 'k' }));
    expect(
      (fetchMock.mock.calls[0][1].body as URLSearchParams).get('user_id'),
    ).toBe('oneproject');

    await submit(createHiveProvider({ apiKey: 'k', publisherId: 'acme' }));
    expect(
      (fetchMock.mock.calls[1][1].body as URLSearchParams).get('user_id'),
    ).toBe('acme');
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
