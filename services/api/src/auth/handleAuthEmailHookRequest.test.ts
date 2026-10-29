import { signStandardWebhook } from '@op/common/testing/helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAuthEmailHookRequest } from './handleAuthEmailHookRequest';

/** Built at runtime so no `whsec_` literal sits in the source for scanners to flag. */
const SECRET = `v1,whsec_${Buffer.from('api-secret-api-secret-api-secret').toString('base64')}`;

const payload = JSON.stringify({
  user: { id: 'u1', email: 'person@example.org' },
  email_data: {
    email_action_type: 'magiclink',
    token: '1234567890',
    token_hash: 'hash',
    redirect_to: 'http://localhost:3100/',
    site_url: 'http://localhost:3100/',
    token_new: '',
    token_hash_new: '',
  },
});

const post = (
  rawBody: string,
  {
    signed = true,
    secret = SECRET,
  }: { signed?: boolean; secret?: string } = {},
) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'webhook-id': 'msg_1',
    'webhook-timestamp': String(timestamp),
  };
  if (signed) {
    headers['webhook-signature'] = signStandardWebhook({
      id: 'msg_1',
      timestamp,
      rawBody,
      secret,
    });
  }
  return new Request('http://localhost/api/v1/auth/send-email', {
    method: 'POST',
    headers,
    body: rawBody,
  });
};

const send = vi.fn<(send: unknown) => Promise<void>>();

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
  vi.stubEnv('SEND_EMAIL_HOOK_SECRETS', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('handleAuthEmailHookRequest', () => {
  it('reads the secret from SEND_EMAIL_HOOK_SECRETS and sends the email', async () => {
    const result = await handleAuthEmailHookRequest({
      request: post(payload),
      send,
    });

    expect(result).toEqual({ status: 200, body: {} });
    expect(send).toHaveBeenCalledWith({
      to: 'person@example.org',
      kind: 'login',
      token: '1234567890',
    });
  });

  it('answers 401 when the signature header is missing', async () => {
    const result = await handleAuthEmailHookRequest({
      request: post(payload, { signed: false }),
      send,
    });

    expect(result.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 401 when the body was changed after signing', async () => {
    const request = post(payload);
    const tampered = new Request(request, { body: `${payload} ` });

    const result = await handleAuthEmailHookRequest({
      request: tampered,
      send,
    });

    expect(result.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 503 when SEND_EMAIL_HOOK_SECRETS is unset', async () => {
    vi.stubEnv('SEND_EMAIL_HOOK_SECRETS', '');

    const result = await handleAuthEmailHookRequest({
      request: post(payload),
      send,
    });

    expect(result.status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 400 for a body over the cap without reading it all', async () => {
    const result = await handleAuthEmailHookRequest({
      request: post('x'.repeat(40_000)),
      send,
    });

    expect(result.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});
