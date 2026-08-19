import { logger } from '@op/logging';
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
    // Each media kind gets its proper field type; `other` (PDF/doc) routes
    // to Checkstep's generic `file` field type rather than being dropped.
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
    expect(body.fields).toContainEqual({
      id: 'media-2',
      type: 'file',
      src: 'https://cdn/doc.pdf',
    });
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

  it('reportForReview files a community report on the submitted content ref', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmpty());
    vi.stubGlobal('fetch', fetchMock);

    await createCheckstepProvider({ apiKey: 'k' }).reportForReview!({
      itemType: 'proposal',
      itemId: '33333333-3333-4333-8333-333333333333',
      roundId: ROUND_ID,
      reporterId: 'profile-9',
      reason: 'Remove this hateful post please!',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.checkstep.com/api/v2/content/report');
    const body = JSON.parse(init.body);
    // Same ref + complex type as the submit, which is how Checkstep
    // associates the report with the ingested content.
    expect(body.id).toBe(
      `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
    );
    expect(body.type).toBe('comment');
    expect(body.reporter).toBe('profile-9');
    expect(body.reason).toBe('Remove this hateful post please!');
    expect(body.tags).toEqual(['#user-report']);
  });

  it('reportForReview falls back to an anonymous reporter and a default reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmpty());
    vi.stubGlobal('fetch', fetchMock);

    await createCheckstepProvider({ apiKey: 'k' }).reportForReview!({
      itemType: 'post',
      itemId: '44444444-4444-4444-8444-444444444444',
      roundId: ROUND_ID,
      reporterId: null,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Checkstep requires a reporter; a sessionless report must still queue.
    expect(body.reporter).toBe('anonymous');
    // The only free-text field on the case, and no entry point collects one.
    expect(body.reason).toMatch(/in-app Report action/);
  });

  it('reportForReview treats a whitespace-only reason as absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmpty());
    vi.stubGlobal('fetch', fetchMock);

    await createCheckstepProvider({ apiKey: 'k' }).reportForReview!({
      itemType: 'post',
      itemId: '44444444-4444-4444-8444-444444444444',
      roundId: ROUND_ID,
      reporterId: 'profile-9',
      reason: '   ',
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reason).toMatch(
      /in-app Report action/,
    );
  });

  it('reportForReview does not retry a 5xx: one attempt, no duplicate report', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createCheckstepProvider({ apiKey: 'k' }).reportForReview!({
        itemType: 'post',
        itemId: '44444444-4444-4444-8444-444444444444',
        roundId: ROUND_ID,
        reporterId: 'profile-9',
      }),
    ).rejects.toThrow('503');

    // Not idempotent: a retry after a late accept files a second report.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a 2xx with a non-JSON body as accepted, not as a failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // A bare `OK`, or an HTML page injected by a proxy in front of the API.
      text: async () => 'OK',
    });
    vi.stubGlobal('fetch', fetchMock);

    // Must not throw — ops would chase a report Checkstep accepted.
    await expect(
      createCheckstepProvider({ apiKey: 'k' }).reportForReview!({
        itemType: 'post',
        itemId: '44444444-4444-4444-8444-444444444444',
        roundId: ROUND_ID,
        reporterId: 'profile-9',
      }),
    ).resolves.toBeUndefined();
  });

  it('treats a 2xx body of literal null as accepted rather than throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Parses fine, but `null` — the caller would throw on `result.id`.
      text: async () => 'null',
    });
    vi.stubGlobal('fetch', fetchMock);

    // Must not throw on `result.id` — the content is already ingested.
    const ref = await createCheckstepProvider({ apiKey: 'k' }).submitForReview!(
      {
        itemType: 'post',
        itemId: '44444444-4444-4444-8444-444444444444',
        roundId: ROUND_ID,
        content: 'review me',
        callbackUrl: 'https://us/webhook',
      },
    );

    // Falls back to our own content ref, exactly as for an empty 202 body.
    expect(ref.providerRecordId).toBe(
      `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
    );
    expect(ref.submittedRefs).toEqual([
      `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
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

  it('parseWebhook honours a caller-supplied policyMap when scoring violations', () => {
    // Simulate a Checkstep account whose violence policy uses a code that is
    // NOT in the adapter defaults. The score must still land under
    // `violence`, not fall through to `other`.
    const [verdict] = createCheckstepProvider({
      apiKey: 'k',
      policyMap: { CUSTOM_VIOLENCE: 'violence' },
    }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: {
          id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
          type: 'comment',
        },
        violations: [{ policy: 'CUSTOM_VIOLENCE', severity: 'high' }],
      }),
      headers: {},
    });

    expect(verdict?.scores?.violence).toBeGreaterThan(0);
    // Nothing leaks into the `other` bucket when the caller's map covers it.
    expect(verdict?.scores?.other).toBeUndefined();
  });

  it('parseWebhook maps the account taxonomy defaults (VLC/SXC/OBS/TER/CEX)', () => {
    // Pins the shipped default map to the account's real policy codes so a
    // regression back to the old guessed codes (VIO/SEX/PRF/CSAM) fails.
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: {
          id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
          type: 'comment',
        },
        violations: [
          { policy: 'VLC', severity: 'high' },
          { policy: 'SXC', severity: 'medium' },
          { policy: 'OBS', severity: 'low' },
          { policy: 'TER', severity: 'high' },
          { policy: 'SPM', severity: 'low' },
        ],
      }),
      headers: {},
    });

    expect(verdict?.scores?.violence).toBe(1); // VLC high, TER high
    expect(verdict?.scores?.sexual).toBeGreaterThan(0); // SXC
    expect(verdict?.scores?.profanity).toBeGreaterThan(0); // OBS
    expect(verdict?.scores?.other).toBeGreaterThan(0); // SPM
  });

  it('parseWebhook escalates a TER (terrorism) violation to a `detach` verdict by default', () => {
    // Terrorism is a mandatory-detach policy alongside child exploitation —
    // pins the shipped DEFAULT_DETACH_POLICIES = [CEX, TER].
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: {
          id: `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
          type: 'comment',
        },
        violations: [{ policy: 'TER', severity: 'high' }],
      }),
      headers: {},
    });

    expect(verdict?.verdict).toBe('detach');
    expect(verdict?.reason).toContain('TER');
  });

  it('parseWebhook honours a caller-supplied detachPolicies list', () => {
    // A deployment whose CSAM policy is named `CSE` (not one of the adapter
    // defaults) still fires the detach path when the config names it. Also
    // map `CSE` in the policyMap so the score attribution stays under `csam`
    // instead of falling through to `other` and firing the unknown-code warn.
    const [verdict] = createCheckstepProvider({
      apiKey: 'k',
      policyMap: { CSE: 'csam' },
      detachPolicies: ['CSE'],
    }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: {
          id: `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
          type: 'comment',
        },
        violations: [{ policy: 'CSE', severity: 'high' }],
      }),
      headers: {},
    });

    expect(verdict?.verdict).toBe('detach');
  });

  it('parseWebhook warns once (and falls through to `other`) when a policy code is unknown', () => {
    // Log-once alert on Checkstep taxonomy drift: an unknown code still
    // scores as `other` (so the flag pipeline runs), but ops sees a warning
    // so the map can be updated before scoring goes stale.
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provider = createCheckstepProvider({
      apiKey: 'k',
      // Force the adapter to see `MYSTERY_CODE_ABC123` as unknown.
      policyMap: { HTE: 'hate' },
    });

    const rawBody = JSON.stringify({
      webhook_type: 'decision',
      decision: 'act',
      content: {
        id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
        type: 'comment',
      },
      violations: [{ policy: 'MYSTERY_CODE_ABC123', severity: 'medium' }],
    });

    const [first] = provider.parseWebhook!({ rawBody, headers: {} });
    const [second] = provider.parseWebhook!({ rawBody, headers: {} });

    expect(first?.scores?.other).toBeGreaterThan(0);
    expect(second?.scores?.other).toBeGreaterThan(0);
    // Same unknown code twice → one warning, not two.
    const unknownWarnings = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes('MYSTERY_CODE_ABC123'),
    );
    expect(unknownWarnings.length).toBe(1);
    warnSpy.mockRestore();
  });

  it('parseWebhook escalates a CSAM violation to a `csam` verdict (even on the same "act" decision)', () => {
    const contentId = `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`;
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'act',
        content: { id: contentId, type: 'comment' },
        violations: [{ policy: 'CEX', severity: 'high' }],
      }),
      headers: {},
    });

    // The verdict must NOT be `flagged` — CSAM is its own decision so the
    // downstream pipeline routes to the mandatory-detach path instead of an
    // ordinary hide.
    expect(verdict?.verdict).toBe('detach');
    expect(verdict?.itemType).toBe('proposal');
    expect(verdict?.itemId).toBe('33333333-3333-4333-8333-333333333333');
    expect(verdict?.scores?.csam).toBeGreaterThan(0);
  });

  it('parseWebhook escalates CSAM even when the top-level decision is a clear (dismiss/allow)', () => {
    // Checkstep moderator marks the item dismissed BUT leaves CSAM on the
    // violation list. Downstream must still detach — a clearing decision
    // never overrides a CSAM policy hit.
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'dismiss',
        content: {
          id: `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
          type: 'comment',
        },
        violations: [{ policy: 'CEX', severity: 'high' }],
      }),
      headers: {},
    });

    expect(verdict?.verdict).toBe('detach');
  });

  it('parseWebhook escalates CSAM even with no top-level decision (interim callback)', () => {
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        content: {
          id: `proposal:33333333-3333-4333-8333-333333333333:${ROUND_ID}`,
          type: 'comment',
        },
        violations: [{ policy: 'CEX', severity: 'high' }],
      }),
      headers: {},
    });

    expect(verdict?.verdict).toBe('detach');
  });

  it('parseWebhook rejects a violations array over the 1000-entry cap', () => {
    // Bounds worst-case scan cost + memory against a hostile / replayed
    // payload. Rejection surfaces to the webhook handler as a 400, which
    // Checkstep will retry — safer than silently trusting an unbounded list.
    const oversized = Array.from({ length: 1001 }, () => ({
      policy: 'HTE',
      severity: 'low',
    }));
    const provider = createCheckstepProvider({ apiKey: 'k' });
    expect(() =>
      provider.parseWebhook!({
        rawBody: JSON.stringify({
          webhook_type: 'decision',
          decision: 'act',
          content: {
            id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
            type: 'comment',
          },
          violations: oversized,
        }),
        headers: {},
      }),
    ).toThrow();
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
          { policy: 'CEX', severity: 'high' },
        ],
      }),
      headers: {},
    });

    expect(verdict?.verdict).toBe('detach');
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

  it('parseWebhook maps an overturn decision to a clear verdict', () => {
    const [verdict] = createCheckstepProvider({ apiKey: 'k' }).parseWebhook!({
      rawBody: JSON.stringify({
        webhook_type: 'decision',
        decision: 'overturn',
        content: {
          id: `post:44444444-4444-4444-8444-444444444444:${ROUND_ID}`,
          type: 'comment',
        },
      }),
      headers: {},
    });

    // Unmapped this yields no verdict, leaving the item hidden with no way back.
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
