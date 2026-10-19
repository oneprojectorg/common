import {
  type PhoneNumber,
  RateLimitError,
  getSmsProvider,
  safeParsePhoneNumber,
} from '@op/common';
import type { inngest } from '@op/events';
import { logger } from '@op/logging';
import type { GetStepTools } from 'inngest';

export const INVALID_PHONE_RESULT = {
  message: 'invalid phone number',
} as const;

export const SMS_UNAVAILABLE_RESULT = {
  message: 'sms sending unavailable',
} as const;

export const SMS_COMMAND_HELP_MESSAGE =
  'Text SHOW to see your decisions, or SHOW and a decision name, for example SHOW columbus. Reply STOP to unsubscribe.';

export const parseInboundNumber = (
  from: string,
  skipped: string,
): PhoneNumber | null => {
  const parsed = safeParsePhoneNumber(from);
  if (parsed.success) {
    return parsed.data;
  }
  logger.info(`Inbound SMS from a non-E.164 number, skipping ${skipped}`, {
    reason: parsed.error.message,
  });
  return null;
};

export const createTextSender = ({
  step,
  to,
  purpose,
  context,
}: {
  step: GetStepTools<typeof inngest>;
  to: PhoneNumber;
  purpose: string;
  context?: Record<string, unknown>;
}) => {
  const provider = getSmsProvider();
  if (!provider?.sendSms) {
    logger.error(
      `Cannot ${purpose}: no Twilio Messaging Service configured`,
      context,
    );
    return null;
  }
  const sendSms = provider.sendSms;
  return (stepId: string, label: string, body: string) =>
    step.run(stepId, async () => {
      const result = await sendSms({ to, body });
      if (result.status === 'rejected' && result.retryable) {
        throw new RateLimitError(`${label} send rejected: ${result.reason}`);
      }
      return result;
    });
};
