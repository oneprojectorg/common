import {
  extractSmsCode,
  parseSmsCommand,
  parseTwilioInboundMessage,
  verifyTwilioWebhookSignature,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

export interface TwilioInboundWebhookRequest {
  rawBody: string;
  signature: string | undefined;
  url: string;
}

export const handleTwilioInboundWebhookRequest = async ({
  rawBody,
  signature,
  url,
}: TwilioInboundWebhookRequest): Promise<{ status: number; body?: string }> => {
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  logger.info('Twilio inbound webhook received', {
    ...describeUrl(url),
    hasSignature: Boolean(signature),
    bodyLength: rawBody.length,
    paramKeys: Object.keys(params),
  });

  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    logger.error(
      'Twilio inbound webhook received but TWILIO_AUTH_TOKEN is unset',
    );
    return { status: 503 };
  }

  if (!signature) {
    logger.warn('Twilio inbound webhook missing X-Twilio-Signature');
    return { status: 401 };
  }

  if (!verifyTwilioWebhookSignature({ authToken, signature, url, params })) {
    logger.warn('Twilio inbound webhook signature verification failed');
    return { status: 401 };
  }

  const message = parseTwilioInboundMessage(params);

  if (!message.messageSid) {
    logger.warn('Twilio inbound webhook missing MessageSid');
    return { status: 400 };
  }

  const { keyword, argument } = parseSmsCommand(message.body);

  await inngest.send({
    id: `sms-inbound-${message.messageSid}`,
    name: Events.smsInboundReceived.name,
    data: {
      from: message.from,
      messageSid: message.messageSid,
      code: extractSmsCode(message.body),
      keyword,
      argument,
    },
  });

  logger.info('Twilio inbound message received', {
    messageSid: message.messageSid,
  });

  return { status: 200, body: '<Response></Response>' };
};

const describeUrl = (url: string) => {
  try {
    const { host, pathname, search } = new URL(url);
    return { host, pathname, hasQuery: search.length > 0 };
  } catch {
    return { host: null, pathname: null, hasQuery: false };
  }
};
