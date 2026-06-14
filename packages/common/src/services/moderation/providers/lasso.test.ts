import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLassoProvider } from './lasso';

const ROUND_ID = '99999999-9999-4999-8999-999999999999';

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

  it('submitForReview sends our content ref + image_urls and returns the record id', async () => {
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
      itemId: '11111111-1111-4111-8111-111111111111',
      roundId: ROUND_ID,
      content: 'review me',
      media: [
        { url: 'https://cdn/a.png', kind: 'image' },
        { url: 'https://cdn/clip.mp4', kind: 'video' },
        { url: 'https://cdn/doc.pdf', kind: 'other' },
      ],
      callbackUrl: 'https://us/webhook',
    });

    expect(ref.providerRecordId).toBe('content-123');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Content ref (item + round) for correlation.
    expect(body.content_id).toBe(
      `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
    );
    // Media is routed by kind into the documented per-type arrays; the `other`
    // (PDF) kind has no Lasso field and is dropped. No per-request callback —
    // the webhook is configured in the dashboard.
    expect(body.image_urls).toEqual(['https://cdn/a.png']);
    expect(body.video_urls).toEqual(['https://cdn/clip.mp4']);
    expect(body.audio_urls).toEqual([]);
    expect(body.callback_url).toBeUndefined();
    // Required envelope fields per the docs.
    expect(body.category?.id).toBeDefined();
    expect(body.subcategory?.id).toBeDefined();
    expect(body.user?.id).toBeDefined();
  });

  it('submitForReview truncates text to the 4000-char API cap', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    await createLassoProvider({ apiToken: 't' }).submitForReview!({
      itemType: 'post',
      itemId: '11111111-1111-4111-8111-111111111111',
      roundId: ROUND_ID,
      content: 'x'.repeat(5000),
      callbackUrl: 'https://us/webhook',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toHaveLength(4000);
  });

  it('parseWebhook maps a blocking ChangeStatus action to a flagged verdict', () => {
    // The content id arrives nested at `content.id` (documented payload shape).
    const verdicts = createLassoProvider({ apiToken: 't' }).parseWebhook!({
      rawBody: JSON.stringify({
        actions: [
          {
            action_type: 'ChangeStatus',
            action_id: 'lasso-action-55',
            type: 'content',
            content: {
              id: `proposal:22222222-2222-4222-8222-222222222222:${ROUND_ID}`,
              created_at: '2023-03-11T15:02:13.178Z',
              user_id: 'lasso-user-1',
            },
            status: 'hidden',
            previous_status: 'allowed',
            actor_id: 'moderator-1',
          },
        ],
      }),
      headers: {},
    });

    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]).toMatchObject({
      itemType: 'proposal',
      itemId: '22222222-2222-4222-8222-222222222222',
      roundId: ROUND_ID,
      verdict: 'flagged',
      externalRecordId: 'lasso-action-55',
    });
  });

  it('parseWebhook maps an allowed ChangeStatus action to a clear verdict', () => {
    const verdicts = createLassoProvider({ apiToken: 't' }).parseWebhook!({
      rawBody: JSON.stringify({
        actions: [
          {
            action_type: 'ChangeStatus',
            type: 'content',
            content: {
              id: `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
            },
            status: 'allowed',
          },
        ],
      }),
      headers: {},
    });

    expect(verdicts[0]?.verdict).toBe('clear');
  });

  it('parseWebhook emits no verdict for an unrecognized status (fails safe)', () => {
    // Vendor schema drift: a new status we don't understand must NOT default
    // to clear (which would un-hide content) — it yields no verdict.
    const verdicts = createLassoProvider({ apiToken: 't' }).parseWebhook!({
      rawBody: JSON.stringify({
        actions: [
          {
            action_type: 'ChangeStatus',
            type: 'content',
            content: {
              id: `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
            },
            status: 'quarantined-new-status',
          },
        ],
      }),
      headers: {},
    });

    expect(verdicts).toEqual([]);
  });

  it('parseWebhook skips non-verdict actions and unrecognized content ids', () => {
    const verdicts = createLassoProvider({ apiToken: 't' }).parseWebhook!({
      rawBody: JSON.stringify({
        actions: [
          { action_type: 'AddTags', type: 'content', id: 'whatever' },
          { action_type: 'StrikeUser', type: 'user', id: 'user-1' },
          // A user-level status change can embed related content — the type
          // guard keeps it from being read as a content verdict.
          {
            action_type: 'ChangeStatus',
            type: 'user',
            content: {
              id: `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
            },
            status: 'hidden',
          },
          // Content not ingested through this integration (e.g. a sync-gate
          // check stored under a bare uuid).
          {
            action_type: 'ChangeStatus',
            type: 'content',
            content: { id: 'some-other-systems-id' },
            status: 'hidden',
          },
          // Flat `id` fallback still accepted.
          {
            action_type: 'ChangeStatus',
            type: 'content',
            id: `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
            status: 'hidden',
          },
        ],
      }),
      headers: {},
    });

    // Only the decodable ChangeStatus content action yields a verdict; the
    // rest are acknowledged without 400ing the delivery.
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]?.verdict).toBe('flagged');
  });

  it('parseWebhook throws on a payload without an actions array', () => {
    expect(() =>
      createLassoProvider({ apiToken: 't' }).parseWebhook!({
        rawBody: JSON.stringify({ status: 'flagged' }),
        headers: {},
      }),
    ).toThrow();
  });

  it('planReviewRefs is the single combined ref submitForReview will use', () => {
    const refs = createLassoProvider({ apiToken: 't' }).planReviewRefs!({
      itemType: 'post',
      itemId: '11111111-1111-4111-8111-111111111111',
      roundId: ROUND_ID,
      content: 'review me',
      media: [{ url: 'https://cdn/img.png', kind: 'image' }],
    });

    expect(refs).toEqual([
      `post:11111111-1111-4111-8111-111111111111:${ROUND_ID}`,
    ]);
  });

  it('planReviewRefs returns no refs when nothing is reviewable (e.g. a user flag)', () => {
    // No text and no media → no task planned, so the flag stays pending for
    // manual handling rather than being auto-cleared by an empty submission.
    const refs = createLassoProvider({ apiToken: 't' }).planReviewRefs!({
      itemType: 'user',
      itemId: '11111111-1111-4111-8111-111111111111',
      roundId: ROUND_ID,
      content: '   ',
    });

    expect(refs).toEqual([]);
  });

  describe('verifyWebhook', () => {
    const signingKey = 'lasso-secret';
    const sign = (rawBody: string): string =>
      `sha256=${createHmac('sha256', signingKey).update(rawBody, 'utf8').digest('base64')}`;

    const providerWithKey = createLassoProvider({
      apiToken: 't',
      webhookSigningKey: signingKey,
    });

    it('accepts a correctly signed webhook', () => {
      const rawBody = '{"content_id":"x"}';
      expect(
        providerWithKey.verifyWebhook!({
          rawBody,
          headers: { 'x-lasso-signature': sign(rawBody) },
        }),
      ).toBe(true);
    });

    it('rejects a tampered body', () => {
      expect(
        providerWithKey.verifyWebhook!({
          rawBody: '{"content_id":"tampered"}',
          headers: { 'x-lasso-signature': sign('{"content_id":"x"}') },
        }),
      ).toBe(false);
    });

    it('rejects when the signature header is missing', () => {
      expect(
        providerWithKey.verifyWebhook!({ rawBody: '{}', headers: {} }),
      ).toBe(false);
    });

    it('is not exposed when no signing key is configured', () => {
      expect(
        createLassoProvider({ apiToken: 't' }).verifyWebhook,
      ).toBeUndefined();
    });
  });
});
