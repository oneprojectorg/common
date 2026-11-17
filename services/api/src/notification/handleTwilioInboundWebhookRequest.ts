import {
  extractSmsCode,
  getPhoneSignupState,
  isCarrierKeyword,
  parseCarrierKeyword,
  parseSmsCommand,
  parseTwilioInboundMessage,
  safeParsePhoneNumber,
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

  const carrierKeyword = isCarrierKeyword(message.optOutType)
    ? message.optOutType
    : parseCarrierKeyword(message.body);

  if (carrierKeyword) {
    logger.info('Twilio inbound message is a carrier keyword, left to Twilio', {
      messageSid: message.messageSid,
      carrierKeyword,
    });
    return { status: 200, body: '<Response></Response>' };
  }

  const { keyword, argument } = parseSmsCommand(message.body);
  const authUserId = await resolveInboundAccount(message.from);

  await inngest.send({
    id: `sms-inbound-${message.messageSid}`,
    name: Events.smsInboundReceived.name,
    data: {
      from: message.from,
      messageSid: message.messageSid,
      code: extractSmsCode(message.body),
      keyword,
      argument,
      to: message.to || null,
      body: message.body,
      ...(authUserId !== undefined ? { authUserId } : {}),
    },
  });

  logger.info('Twilio inbound message received', {
    messageSid: message.messageSid,
  });

  return { status: 200, body: '<Response></Response>' };
};

const resolveInboundAccount = async (
  from: string,
): Promise<string | null | undefined> => {
  const parsed = safeParsePhoneNumber(from);
  if (!parsed.success) {
    return null;
  }
  try {
    const state = await getPhoneSignupState({ phone: parsed.data });
    return state.status === 'confirmed' ? state.authUserId : null;
  } catch (error) {
    // The functions fall back to their own lookup when the field is absent.
    logger.error('Could not resolve the inbound SMS account', { error });
    return undefined;
  }
};

const describeUrl = (url: string) => {
  try {
    const { host, pathname, search } = new URL(url);
    return { host, pathname, hasQuery: search.length > 0 };
  } catch {
    return { host: null, pathname: null, hasQuery: false };
  }
};
