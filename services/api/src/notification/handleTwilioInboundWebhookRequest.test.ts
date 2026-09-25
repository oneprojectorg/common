import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { handleTwilioInboundWebhookRequest } from './handleTwilioInboundWebhookRequest';

const AUTH_TOKEN = 'test-auth-token';
const URL = 'https://example.org/api/v1/notifications/twilio/inbound';
const MESSAGE_PARAMS = {
  From: '+15005550006',
  Body: 'YES',
  MessageSid: 'SM456',
};

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

describe('handleTwilioInboundWebhookRequest', () => {
  it('accepts a validly signed message and forwards it to Inngest', async () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const rawBody = rawBodyOf(MESSAGE_PARAMS);
    const signature = signTwilioRequest(AUTH_TOKEN, URL, MESSAGE_PARAMS);

    const result = await handleTwilioInboundWebhookRequest({
      rawBody,
      signature,
      url: URL,
    });

    expect(result).toEqual({ status: 200 });
    expect(inngest.send).toHaveBeenCalledWith({
      id: 'sms-inbound-SM456',
      name: Events.smsInboundReceived.name,
      data: { from: '+15005550006', body: 'YES', messageSid: 'SM456' },
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Twilio inbound message received',
      {
        messageSid: 'SM456',
      },
    );
  });

  it('rejects a request with no signature and does not forward it', async () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const rawBody = rawBodyOf(MESSAGE_PARAMS);

    const result = await handleTwilioInboundWebhookRequest({
      rawBody,
      signature: undefined,
      url: URL,
    });

    expect(result).toEqual({ status: 401 });
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('rejects a message whose body was tampered with after signing', async () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const signature = signTwilioRequest(AUTH_TOKEN, URL, MESSAGE_PARAMS);
    const tamperedBody = rawBodyOf({
      ...MESSAGE_PARAMS,
      Body: 'something else',
    });

    const result = await handleTwilioInboundWebhookRequest({
      rawBody: tamperedBody,
      signature,
      url: URL,
    });

    expect(result).toEqual({ status: 401 });
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('given a validly signed message with no MessageSid, when handled, then it rejects the request without forwarding it', async () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    const params = { From: '+15005550006', Body: 'YES', MessageSid: '' };
    const rawBody = rawBodyOf(params);
    const signature = signTwilioRequest(AUTH_TOKEN, URL, params);

    const result = await handleTwilioInboundWebhookRequest({
      rawBody,
      signature,
      url: URL,
    });

    expect(result).toEqual({ status: 400 });
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('reports misconfiguration rather than forwarding when TWILIO_AUTH_TOKEN is unset', async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const rawBody = rawBodyOf(MESSAGE_PARAMS);

    const result = await handleTwilioInboundWebhookRequest({
      rawBody,
      signature: 'irrelevant',
      url: URL,
    });

    expect(result).toEqual({ status: 503 });
    expect(inngest.send).not.toHaveBeenCalled();
  });
});
