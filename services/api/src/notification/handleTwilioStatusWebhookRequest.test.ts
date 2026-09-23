import { logger } from '@op/logging';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { handleTwilioStatusWebhookRequest } from './handleTwilioStatusWebhookRequest';

const AUTH_TOKEN = 'test-auth-token';
const URL = 'https://example.org/api/v1/notifications/twilio/status';
const CALLBACK_PARAMS = { MessageSid: 'SM123', MessageStatus: 'delivered' };

const signTwilioRequest = (
  authToken: string,
  url: string,
  params: Record<string, string>,
): string => {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');
};

const rawBodyOf = (params: Record<string, string>): string =>
  new URLSearchParams(params).toString();

afterEach(() => {
  delete process.env.TWILIO_AUTH_TOKEN;
});

describe('handleTwilioStatusWebhookRequest', () => {
  it('accepts a validly signed callback and logs the delivery status', () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const rawBody = rawBodyOf(CALLBACK_PARAMS);
    const signature = signTwilioRequest(AUTH_TOKEN, URL, CALLBACK_PARAMS);

    const result = handleTwilioStatusWebhookRequest({
      rawBody,
      signature,
      url: URL,
    });

    expect(result).toEqual({ status: 200 });
    expect(logger.info).toHaveBeenCalledWith('Twilio message status callback', {
      messageSid: 'SM123',
      status: 'delivered',
      errorCode: undefined,
    });
  });

  it('rejects a request with no signature', () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const rawBody = rawBodyOf(CALLBACK_PARAMS);

    const result = handleTwilioStatusWebhookRequest({
      rawBody,
      signature: undefined,
      url: URL,
    });

    expect(result).toEqual({ status: 401 });
    expect(logger.warn).toHaveBeenCalledWith(
      'Twilio status webhook missing X-Twilio-Signature',
    );
  });

  it('rejects a callback whose body was tampered with after signing', () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const signature = signTwilioRequest(AUTH_TOKEN, URL, CALLBACK_PARAMS);
    const tamperedBody = rawBodyOf({
      ...CALLBACK_PARAMS,
      MessageStatus: 'failed',
    });

    const result = handleTwilioStatusWebhookRequest({
      rawBody: tamperedBody,
      signature,
      url: URL,
    });

    expect(result).toEqual({ status: 401 });
    expect(logger.warn).toHaveBeenCalledWith(
      'Twilio status webhook signature verification failed',
    );
  });

  it('rejects a signature produced with the wrong auth token', () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const rawBody = rawBodyOf(CALLBACK_PARAMS);
    const signature = signTwilioRequest(
      'a-different-token',
      URL,
      CALLBACK_PARAMS,
    );

    const result = handleTwilioStatusWebhookRequest({
      rawBody,
      signature,
      url: URL,
    });

    expect(result).toEqual({ status: 401 });
  });

  it('reports misconfiguration rather than rejecting when TWILIO_AUTH_TOKEN is unset', () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const rawBody = rawBodyOf(CALLBACK_PARAMS);

    const result = handleTwilioStatusWebhookRequest({
      rawBody,
      signature: 'irrelevant',
      url: URL,
    });

    expect(result).toEqual({ status: 503 });
    expect(logger.error).toHaveBeenCalledWith(
      'Twilio status webhook received but TWILIO_AUTH_TOKEN is unset',
    );
  });
});
