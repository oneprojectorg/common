import {
  parseTwilioStatusCallback,
  verifyTwilioWebhookSignature,
} from '@op/common';
import { logger } from '@op/logging';

export interface TwilioStatusWebhookRequest {
  rawBody: string;
  signature: string | undefined;
  url: string;
}

export const handleTwilioStatusWebhookRequest = ({
  rawBody,
  signature,
  url,
}: TwilioStatusWebhookRequest): { status: number; body?: string } => {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    logger.error(
      'Twilio status webhook received but TWILIO_AUTH_TOKEN is unset',
    );
    return { status: 503 };
  }

  if (!signature) {
    logger.warn('Twilio status webhook missing X-Twilio-Signature');
    return { status: 401 };
  }

  const params = Object.fromEntries(new URLSearchParams(rawBody));

  if (!verifyTwilioWebhookSignature({ authToken, signature, url, params })) {
    logger.warn('Twilio status webhook signature verification failed');
    return { status: 401 };
  }

  const callback = parseTwilioStatusCallback(params);

  logger.info('Twilio message status callback', {
    messageSid: callback.messageSid,
    status: callback.status,
    errorCode: callback.errorCode,
  });

  return { status: 200, body: '<Response></Response>' };
};
