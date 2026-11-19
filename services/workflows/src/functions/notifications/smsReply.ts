import {
  type PhoneNumber,
  RateLimitError,
  getSmsProvider,
  recordSmsMessage,
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

export const SMS_COMMANDS_FEATURE_FLAG = 'sms-commands';

export const SMS_COMMAND_HELP_MESSAGE =
  'Text SHOW to see your decisions, or SHOW and a decision name, for example SHOW columbus.\nReply STOP to unsubscribe.';

export const SMS_COMMAND_LIST_MESSAGE = [
  'Commands:',
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
  'L [question] ask the assistant',
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
  authUserId,
  phoneNumberId,
}: {
  step: GetStepTools<typeof inngest>;
  to: PhoneNumber;
  from?: PhoneNumber;
  purpose: string;
  context?: Record<string, unknown>;
  authUserId?: string | null;
  phoneNumberId?: string | null;
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
      // A log failure must not fail the step: the SMS already went out, and a
      // retried step would send it again.
      try {
        await recordSmsMessage({
          direction: 'outbound',
          body,
          phoneNumberId: phoneNumberId ?? null,
          authUserId: authUserId ?? null,
          counterpartE164: to,
          providerSid:
            result.status === 'accepted' ? result.providerMessageId : null,
          status: result.status === 'accepted' ? 'sent' : 'failed',
        });
      } catch (error) {
        logger.error('Outbound SMS could not be logged', { error });
      }
      return result;
    });
};
