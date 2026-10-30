import { describe, expect, it } from 'vitest';

import {
  hookSecret,
  signStandardWebhook,
  signedWebhookHeaders,
} from '../../../../testing/helpers/signStandardWebhook';
import { verifyStandardWebhookSignature } from './verifyStandardWebhookSignature';

const SECRET = hookSecret('secret-one-secret-one-secret-one');
const OTHER_SECRET = hookSecret('secret-two-secret-two-secret-two');

const NOW_SECONDS = 1_800_000_000;
const now = NOW_SECONDS * 1000;
const rawBody = '{"email_data":{"token":"123456"}}';

const signatureFor = (secret: string) =>
  signStandardWebhook({ id: 'msg_1', timestamp: NOW_SECONDS, rawBody, secret });

const headersFor = (
  secret: string,
  overrides: Record<string, string> = {},
): Headers => {
  const headers = signedWebhookHeaders({
    rawBody,
    secret,
    timestamp: NOW_SECONDS,
  });
  for (const [name, value] of Object.entries(overrides)) {
    headers.set(name, value);
  }
  return headers;
};

const verify = (
  headers: Headers,
  { secrets = SECRET, at = now }: { secrets?: string; at?: number } = {},
) => verifyStandardWebhookSignature({ rawBody, headers, secrets, now: at });

describe('verifyStandardWebhookSignature', () => {
  it('accepts a request signed with the configured secret', () => {
    expect(verify(headersFor(SECRET))).toBe(true);
  });

  it('accepts the old secret during a rotation', () => {
    expect(
      verify(headersFor(OTHER_SECRET), {
        secrets: `${SECRET}|${OTHER_SECRET}`,
      }),
    ).toBe(true);
  });

  it('accepts a header that offers several signatures when one matches', () => {
    const signature = `${signatureFor(OTHER_SECRET)} ${signatureFor(SECRET)}`;

    expect(verify(headersFor(SECRET, { 'webhook-signature': signature }))).toBe(
      true,
    );
  });

  it('accepts the signature list GoTrue sends during a rotation, in either order', () => {
    // GoTrue joins the entries with ", ", so all but the last carry a trailing comma.
    for (const signature of [
      `${signatureFor(SECRET)}, ${signatureFor(OTHER_SECRET)}`,
      `${signatureFor(OTHER_SECRET)}, ${signatureFor(SECRET)}`,
    ]) {
      expect(
        verify(headersFor(SECRET, { 'webhook-signature': signature })),
      ).toBe(true);
    }
  });

  it('rejects a signature made with another secret', () => {
    expect(verify(headersFor(OTHER_SECRET))).toBe(false);
  });

  it('rejects a body that changed after signing', () => {
    expect(
      verifyStandardWebhookSignature({
        rawBody: `${rawBody} `,
        headers: headersFor(SECRET),
        secrets: SECRET,
        now,
      }),
    ).toBe(false);
  });

  it('rejects a timestamp more than five minutes in the past', () => {
    expect(verify(headersFor(SECRET), { at: now + 6 * 60 * 1000 })).toBe(false);
  });

  it('rejects a timestamp more than five minutes in the future', () => {
    expect(verify(headersFor(SECRET), { at: now - 6 * 60 * 1000 })).toBe(false);
  });

  it('accepts a timestamp inside the five-minute window', () => {
    expect(verify(headersFor(SECRET), { at: now + 4 * 60 * 1000 })).toBe(true);
    expect(verify(headersFor(SECRET), { at: now - 4 * 60 * 1000 })).toBe(true);
  });

  it('rejects a timestamp that is not a whole number of seconds', () => {
    for (const timestamp of ['abc', '', '1800000000.5', 'NaN']) {
      expect(
        verify(headersFor(SECRET, { 'webhook-timestamp': timestamp })),
      ).toBe(false);
    }
  });

  it('rejects a request missing any of the three headers', () => {
    for (const name of [
      'webhook-id',
      'webhook-timestamp',
      'webhook-signature',
    ]) {
      const headers = headersFor(SECRET);
      headers.delete(name);
      expect(verify(headers)).toBe(false);
    }
  });

  it('rejects a signature list with no v1 entry', () => {
    expect(verify(headersFor(SECRET, { 'webhook-signature': 'v2,abc' }))).toBe(
      false,
    );
  });

  it('rejects a v1 entry that is not a signature', () => {
    for (const signature of ['v1,', 'v1,abc', 'v1,!!!not-base64!!!']) {
      expect(
        verify(headersFor(SECRET, { 'webhook-signature': signature })),
      ).toBe(false);
    }
  });

  it('rejects a signature truncated by one character', () => {
    const signature = signatureFor(SECRET).slice(0, -1);

    expect(verify(headersFor(SECRET, { 'webhook-signature': signature }))).toBe(
      false,
    );
  });

  it('rejects everything when the secret decodes to nothing', () => {
    expect(verify(headersFor(SECRET), { secrets: hookSecret('') })).toBe(false);
  });
});
