import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCheckstepProvider } from './checkstep';

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

// Checkstep acks an async submit with a success status and an empty body.
const okEmpty = () => ({
  ok: true,
  status: 202,
  json: async () => {
    throw new SyntaxError('Unexpected end of JSON input');
  },
  text: async () => '',
});

const ROUND_ID = '99999999-9999-4999-8999-999999999999';

afterEach(() => vi.unstubAllGlobals());

describe('createCheckstepProvider', () => {
  it('submitForReview sends our content ref + callback + media and returns the record id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'cs-789' }));
    vi.stubGlobal('fetch', fetchMock);

    const ref = await createCheckstepProvider({
      apiKey: 'k',
    }).submitForReview!({
      itemType: 'proposal',
      itemId: '33333333-3333-4333-8333-333333333333',
      roundId: ROUND_ID,
      content: 'review me',
      media: [
        { url: 'https://cdn/img.png', kind: 'image' },
        { url: 'https://cdn/clip.mp4', kind: 'video' },
        { url: 'https://cdn/doc.pdf', kind: 'other' },
      ],
      callbackUrl: 'https://us/webhook',
    });

    expect(ref.providerRecordId).toBe('cs-789');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Content ref (item + round) for webhook correlation.
    expect(body.id).toBe(
      `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
    );
    expect(body.callback_url).toBe('https://us/webhook');
    // Required top-level complex type; our account defines only `comment`.
    expect(body.type).toBe('comment');
    // Each media kind gets its proper field type; `other` (PDF) is dropped.
    expect(body.fields).toContainEqual({
      id: 'media-0',
      type: 'image',
      src: 'https://cdn/img.png',
    });
    expect(body.fields).toContainEqual({
      id: 'media-1',
      type: 'video',
      src: 'https://cdn/clip.mp4',
    });
    expect(
      body.fields.some((f: { src: string }) => f.src === 'https://cdn/doc.pdf'),
    ).toBe(false);
  });

  it('submitForReview tolerates an empty ack body and falls back to the content ref', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmpty());
    vi.stubGlobal('fetch', fetchMock);

    const ref = await createCheckstepProvider({ apiKey: 'k' }).submitForReview!(
      {
        itemType: 'proposal',
        itemId: '33333333-3333-4333-8333-333333333333',
        roundId: ROUND_ID,
        content: 'review me',
        media: [],
        callbackUrl: 'https://us/webhook',
      },
    );

    // No `id` in the (empty) response → fall back to our content ref.
    expect(ref.providerRecordId).toBe(
      `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
    );
    expect(ref.submittedRefs).toEqual([
      `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
    ]);
  });

  it('parseWebhook maps a flagging decision to a flagged verdict for our item', () => {
    const contentId = `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`;
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: { id: contentId, type: 'comment' },
        violations: [{ policy: 'HTE', severity: 'high' }],
      }),
      headers: {},
    });

    expect(verdict).toMatchObject({
      itemType: 'post',
      itemId: '44444444-4444-4444-8444-444444444444',
      roundId: ROUND_ID,
      verdict: 'flagged',
      externalRecordId: contentId,
    });
    expect(verdict?.scores?.hate).toBeGreaterThan(0);
  });

  it('parseWebhook escalates a CSAM violation to a `csam` verdict (even on the same "act" decision)', () => {
    const contentId = `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`;
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: { id: contentId, type: 'comment' },
        violations: [{ policy: 'CSAM', severity: 'high' }],
      }),
      headers: {},
    });

    // The verdict must NOT be `flagged` — CSAM is its own decision so the
    // downstream pipeline routes to the mandatory-detach path instead of an
    // ordinary hide.
    expect(verdict?.verdict).toBe('csam');
    expect(verdict?.itemType).toBe('proposal');
    expect(verdict?.itemId).toBe('33333333-3333-4333-8333-333333333333');
    expect(verdict?.scores?.csam).toBeGreaterThan(0);
  });

  it('parseWebhook escalates CSAM even when only one of several violations matches', () => {
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: {
          id: `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
          type: 'comment',
        },
        violations: [
          { policy: 'HTE', severity: 'medium' },
          { policy: 'CSEA', severity: 'high' },
        ],
      }),
      headers: {},
    });

    expect(verdict?.verdict).toBe('csam');
  });

  it('parseWebhook maps a dismiss decision to a clear verdict', () => {
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'dismiss',
        content: {
          id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
          type: 'comment',
        },
      }),
      headers: {},
    });

    expect(verdict?.verdict).toBe('clear');
  });

  it('parseWebhook acknowledges a payload missing the content id without throwing', () => {
    // Probes/test deliveries from the dashboard often omit content; we ack
    // with no verdicts (→ 200) rather than 400ing into provider retries.
    const verdicts = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
      }),
      headers: {},
    });

    expect(verdicts).toEqual([]);
  });

  it('parseWebhook skips non-decision webhook types (author-decision, incident-closed, analysed-content)', () => {
    const provider = createCheckstepProvider({ apiKey: 'k' });
    for (const webhookType of [
      'author-decision',
      'incident-closed',
      'analysed-content',
    ]) {
      const verdicts = provider.parseWebhook!({
        rawBody: JSON.stringify({
          webhook_type: webhookType,
          decision: 'act',
          content: {
            id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
            type: 'comment',
          },
        }),
        headers: {},
      });
      expect(verdicts).toEqual([]);
    }
  });

  it('parseWebhook emits no verdict for an unrecognized decision (fails safe)', () => {
    // A decision we don't understand must NOT default to clear (which would
    // dismiss an open flag) — it yields no verdict.
    const verdicts = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'some-new-decision',
        content: {
          id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
          type: 'comment',
        },
      }),
      headers: {},
    });

    expect(verdicts).toEqual([]);
  });

  it('parseWebhook emits no verdict for a decision-less ack/interim callback', () => {
    const verdicts = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        content: {
          id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
          type: 'comment',
        },
      }),
      headers: {},
    });

    expect(verdicts).toEqual([]);
  });

  it('parseWebhook skips a delivery for a foreign content id (acknowledges, no 400)', () => {
    const verdicts = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: { id: 'some-other-systems-bare-id', type: 'comment' },
      }),
      headers: {},
    });

    expect(verdicts).toEqual([]);
  });

  it('planReviewRefs returns no refs when nothing is reviewable', () => {
    const refs = createCheckstepProvider({ apiKey: 'k' }).planReviewRefs!({
      itemType: 'user',
      itemId: '44444444-4444-4444-8444-444444444444',
      roundId: ROUND_ID,
      content: '',
    });

    expect(refs).toEqual([]);
  });

  it('planReviewRefs is the single combined ref submitForReview will use', () => {
    const refs = createCheckstepProvider({ apiKey: 'k' }).planReviewRefs!({
      itemType: 'proposal',
      itemId: '33333333-3333-4333-8333-333333333333',
      roundId: ROUND_ID,
      content: 'review me',
      media: [{ url: 'https://cdn/img.png', kind: 'image' }],
    });

    expect(refs).toEqual([
      `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
    ]);
  });

  describe('verifyWebhook', () => {
    const signingKey = 'signing-key';
    const sign = (rawBody: string, date: string, nonce: string): string => {
      const contentHash = createHash('sha256')
        .update(`${rawBody}.${date}.${nonce}`, 'utf8')
        .digest('hex');
      return createHmac('sha256', signingKey)
        .update(contentHash, 'utf8')
        .digest('hex');
    };

    const providerWithKey = createCheckstepProvider({
      apiKey: 'k',
      webhookSigningKey: signingKey,
    });

    it('accepts a correctly signed webhook', () => {
      const rawBody = '{"id":"x"}';
      const date = new Date().toISOString();
      const nonce = 'nonce-1';

      expect(
        providerWithKey.verifyWebhook!({
          rawBody,
          headers: {
            'x-auth-signature': sign(rawBody, date, nonce),
            'x-auth-date': date,
            'x-auth-nonce': nonce,
          },
        }),
      ).toBe(true);
    });

    it('accepts when any of the comma-separated signatures matches (key rotation)', () => {
      const rawBody = '{"id":"x"}';
      const date = new Date().toISOString();
      const nonce = 'nonce-1';

      expect(
        providerWithKey.verifyWebhook!({
          rawBody,
          headers: {
            'x-auth-signature': `deadbeef,${sign(rawBody, date, nonce)}`,
            'x-auth-date': date,
            'x-auth-nonce': nonce,
          },
        }),
      ).toBe(true);
    });

    it('rejects a tampered body', () => {
      const date = new Date().toISOString();
      const nonce = 'nonce-1';

      expect(
        providerWithKey.verifyWebhook!({
          rawBody: '{"id":"tampered"}',
          headers: {
            'x-auth-signature': sign('{"id":"x"}', date, nonce),
            'x-auth-date': date,
            'x-auth-nonce': nonce,
          },
        }),
      ).toBe(false);
    });

    it('rejects when signature headers are missing', () => {
      expect(
        providerWithKey.verifyWebhook!({ rawBody: '{}', headers: {} }),
      ).toBe(false);
    });

    it('rejects a replay outside the freshness window', () => {
      const rawBody = '{"id":"x"}';
      const staleDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const nonce = 'nonce-1';

      expect(
        providerWithKey.verifyWebhook!({
          rawBody,
          headers: {
            'x-auth-signature': sign(rawBody, staleDate, nonce),
            'x-auth-date': staleDate,
            'x-auth-nonce': nonce,
          },
        }),
      ).toBe(false);
    });

    it('is not exposed when no signing key is configured', () => {
      expect(
        createCheckstepProvider({ apiKey: 'k' }).verifyWebhook,
      ).toBeUndefined();
    });
  });
});
