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
  'Text SHOW to see your decisions, or SHOW and a decision name, for example SHOW columbus.\nReply STOP to unsubscribe.';

export const SMS_ALREADY_JOINED_MESSAGE =
  'You already have an account. Text SHOW to see your decisions.';

export const SMS_COMMAND_LIST_MESSAGE = [
  'Commands:',
  'JOIN sign up',
  'SHOW [name] your decisions, or one of them',
  'VOTE [name] register to vote',
  'AGREE confirm your registration',
  'PROPOSALS [name] browse the ballot',
  'MORE next page',
  'INFO [code] one proposal',
  'LIST your picks',
  'MOVE [code] [position] reorder a pick',
  'REMOVE [code] drop a pick',
  'DONE review your ballot',
  'SUBMIT cast it',
  'INFO-HELP this list',
  'Reply STOP to unsubscribe.',
].join('\n');

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
  from,
  purpose,
  context,
}: {
  step: GetStepTools<typeof inngest>;
  to: PhoneNumber;
  from?: PhoneNumber;
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
      const result = await sendSms({ to, body, ...(from ? { from } : {}) });
      if (result.status === 'rejected' && result.retryable) {
        throw new RateLimitError(`${label} send rejected: ${result.reason}`);
      }
      return result;
    });
};
