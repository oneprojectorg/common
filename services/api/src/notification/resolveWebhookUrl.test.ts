import { describe, expect, it } from 'vitest';

import { resolveWebhookUrl } from './resolveWebhookUrl';

const LOCAL_URL = 'http://localhost:3301/api/v1/notifications/twilio/inbound';

describe('resolveWebhookUrl', () => {
  it('given a request forwarded by a tunnel, then the url Twilio signed is rebuilt from the forwarded protocol and host', () => {
    expect(
      resolveWebhookUrl({
        url: LOCAL_URL,
        trustForwardedHeaders: true,
        headers: new Headers({
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'example.ngrok-free.dev',
          host: 'localhost:3301',
        }),
      }),
    ).toBe(
      'https://example.ngrok-free.dev/api/v1/notifications/twilio/inbound',
    );
  });

  it('given no forwarded headers, then the url is returned unchanged', () => {
    expect(
      resolveWebhookUrl({
        url: LOCAL_URL,
        trustForwardedHeaders: true,
        headers: new Headers({ host: 'localhost:3301' }),
      }),
    ).toBe(LOCAL_URL);
  });

  it('given a forwarded protocol but no forwarded host, then the host header is used', () => {
    expect(
      resolveWebhookUrl({
        url: LOCAL_URL,
        trustForwardedHeaders: true,
        headers: new Headers({
          'x-forwarded-proto': 'https',
          host: 'example.ngrok-free.dev',
        }),
      }),
    ).toBe(
      'https://example.ngrok-free.dev/api/v1/notifications/twilio/inbound',
    );
  });

  it('given forwarded headers that list several hops, then the first hop wins and the query string survives', () => {
    expect(
      resolveWebhookUrl({
        url: `${LOCAL_URL}?from=test`,
        trustForwardedHeaders: true,
        headers: new Headers({
          'x-forwarded-proto': 'https, http',
          'x-forwarded-host': 'example.ngrok-free.dev, localhost:3301',
        }),
      }),
    ).toBe(
      'https://example.ngrok-free.dev/api/v1/notifications/twilio/inbound?from=test',
    );
  });
});

describe('resolveWebhookUrl in production', () => {
  it('given forwarded headers that are not trusted, then the url is returned unchanged so a sender cannot pick the url the signature is checked against', () => {
    expect(
      resolveWebhookUrl({
        url: LOCAL_URL,
        trustForwardedHeaders: false,
        headers: new Headers({
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'attacker.example',
          host: 'localhost:3301',
        }),
      }),
    ).toBe(LOCAL_URL);
  });
});
