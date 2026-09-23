import {
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
}: TwilioInboundWebhookRequest): Promise<{ status: number }> => {
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

  const params = Object.fromEntries(new URLSearchParams(rawBody));

  if (!verifyTwilioWebhookSignature({ authToken, signature, url, params })) {
    logger.warn('Twilio inbound webhook signature verification failed');
    return { status: 401 };
  }

  const message = parseTwilioInboundMessage(params);

  await inngest.send({
    id: `sms-inbound-${message.messageSid}`,
    name: Events.smsInboundReceived.name,
    data: message,
  });

  logger.info('Twilio inbound message received', {
    messageSid: message.messageSid,
  });

  return { status: 200 };
};
