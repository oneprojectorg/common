import { describe, expect, it } from 'vitest';

import {
  signStandardWebhook,
  verifyStandardWebhookSignature,
} from './verifyStandardWebhookSignature';

const SECRET = 'v1,whsec_c2VjcmV0LW9uZS1zZWNyZXQtb25lLXNlY3JldC1vbmU=';
const OTHER_SECRET = 'v1,whsec_c2VjcmV0LXR3by1zZWNyZXQtdHdvLXNlY3JldC10d28=';

const NOW_SECONDS = 1_800_000_000;
const now = NOW_SECONDS * 1000;
const rawBody = '{"email_data":{"token":"123456"}}';

const headersFor = (
  secret: string,
  overrides: Record<string, string> = {},
): Record<string, string> => ({
  'webhook-id': 'msg_1',
  'webhook-timestamp': String(NOW_SECONDS),
  'webhook-signature': signStandardWebhook({
    id: 'msg_1',
    timestamp: NOW_SECONDS,
    rawBody,
    secret,
  }),
  ...overrides,
});

describe('verifyStandardWebhookSignature', () => {
  it('accepts a request signed with the configured secret', () => {
    expect(
      verifyStandardWebhookSignature({
        rawBody,
        headers: headersFor(SECRET),
        secrets: SECRET,
        now,
      }),
    ).toBe(true);
  });

  it('reads the headers case-insensitively', () => {
    const lower = headersFor(SECRET);
    const headers = {
      'Webhook-Id': lower['webhook-id'] ?? '',
      'Webhook-Timestamp': lower['webhook-timestamp'] ?? '',
      'Webhook-Signature': lower['webhook-signature'] ?? '',
    };
    expect(
      verifyStandardWebhookSignature({
        rawBody,
        headers,
        secrets: SECRET,
        now,
      }),
    ).toBe(true);
  });

  it('accepts the old secret during a rotation', () => {
    expect(
      verifyStandardWebhookSignature({
        rawBody,
        headers: headersFor(SECRET),
        secrets: `${OTHER_SECRET}|${SECRET}`,
        now,
      }),
    ).toBe(true);
  });

  it('rejects a signature made with another secret', () => {
    expect(
      verifyStandardWebhookSignature({
        rawBody,
        headers: headersFor(OTHER_SECRET),
        secrets: SECRET,
        now,
      }),
    ).toBe(false);
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

  it('rejects a timestamp outside the five-minute window', () => {
    expect(
      verifyStandardWebhookSignature({
        rawBody,
        headers: headersFor(SECRET),
        secrets: SECRET,
        now: now + 6 * 60 * 1000,
      }),
    ).toBe(false);
  });

  it('rejects a request missing any of the three headers', () => {
    for (const name of [
      'webhook-id',
      'webhook-timestamp',
      'webhook-signature',
    ]) {
      const headers = headersFor(SECRET);
      delete headers[name];
      expect(
        verifyStandardWebhookSignature({
          rawBody,
          headers,
          secrets: SECRET,
          now,
        }),
      ).toBe(false);
    }
  });

  it('rejects a signature list with no v1 entry', () => {
    expect(
      verifyStandardWebhookSignature({
        rawBody,
        headers: headersFor(SECRET, { 'webhook-signature': 'v2,abc' }),
        secrets: SECRET,
        now,
      }),
    ).toBe(false);
  });

  it('rejects everything when the secret decodes to nothing', () => {
    expect(
      verifyStandardWebhookSignature({
        rawBody,
        headers: headersFor(SECRET),
        secrets: 'v1,whsec_',
        now,
      }),
    ).toBe(false);
  });
});
