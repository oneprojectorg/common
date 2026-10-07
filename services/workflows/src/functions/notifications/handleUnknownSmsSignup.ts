import { isFeatureEnabled } from '@op/analytics';
import {
  type PhoneSignupConfirmation,
  confirmPhoneSignupCode,
  getPhoneSignupState,
  getSmsProvider,
  PHONE_SIGNUP_REPLY_WINDOW_MINUTES,
  RateLimitError,
  requestPhoneSignupCode,
  safeParsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const SMS_SIGNUP_FEATURE_FLAG = 'sms-signup';
const MAX_REPLY_ATTEMPTS = 3;
const { smsInboundReceived } = Events;

type ConfirmationOutcome =
  | Extract<PhoneSignupConfirmation, { status: 'confirmed' }>
  | { status: 'timed_out' }
  | { status: 'exhausted' };

export const handleUnknownSmsSignup = inngest.createFunction(
  {
    id: 'handleUnknownSmsSignup',
    rateLimit: {
      key: 'event.data.from',
      limit: 10,
      period: '1h',
    },
    throttle: {
      limit: 20,
      period: '1h',
    },
    debounce: {
      key: 'event.data.from',
      period: '1m',
    },
    singleton: {
      key: 'event.data.from',
      mode: 'skip',
    },
  },
  { event: smsInboundReceived.name },
  async ({ event, step }) => {
    const { from } = smsInboundReceived.schema.parse(event.data);

    logger.info('SMS Signup trigger');

    const flagEnabled = await step.run('check-feature-flag', () =>
      isFeatureEnabled(SMS_SIGNUP_FEATURE_FLAG, 'server'),
    );

    if (!flagEnabled) {
      logger.info('SMS signup feature flag is disabled, skipping');
      return { message: 'sms signup disabled' };
    }

    const parsedFrom = safeParsePhoneNumber(from);

    if (!parsedFrom.success) {
      logger.info('Inbound SMS from a non-E.164 number, skipping signup', {
        reason: parsedFrom.error.message,
      });
      return { message: 'invalid phone number' };
    }

    const to = parsedFrom.data;

    const state = await step.run('check-known-number', () =>
      getPhoneSignupState({ phone: to }),
    );

    if (state.status === 'confirmed') {
      logger.info('Inbound SMS from a known number, skipping signup flow', {
        profileId: state.profileId,
      });
      return { message: 'known number, skipped' };
    }

    if (state.status === 'attempt_in_progress') {
      logger.info(
        'Inbound SMS is a reply to a signup attempt still in its window, skipping',
        { codeSentAt: state.codeSentAt },
      );
      return { message: 'signup attempt in progress, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot start SMS signup: no Twilio Messaging Service configured',
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;

    const codeRequest = await step.run('request-signup-code', () =>
      requestPhoneSignupCode({ phone: to }),
    );

    if (codeRequest.status === 'rejected') {
      logger.warn('GoTrue refused to send a signup code, aborting signup', {
        reason: codeRequest.reason,
      });
      return { message: 'code send rejected', reason: codeRequest.reason };
    }

    const consentResult = await step.run('send-consent-request', async () => {
      const result = await sendSms({
        to,
        body: 'Reply with the code we just texted you to create your Common account.',
      });
      if (result.status === 'rejected' && result.retryable) {
        throw new RateLimitError(
          `Consent request send rejected: ${result.reason}`,
        );
      }
      return result;
    });

    if (consentResult.status === 'rejected') {
      logger.warn('Consent request permanently rejected, aborting signup', {
        reason: consentResult.reason,
      });
      return { message: 'consent send rejected', reason: consentResult.reason };
    }

    const replyDeadline = await step.run(
      'start-reply-window',
      () => Date.now() + PHONE_SIGNUP_REPLY_WINDOW_MINUTES * 60_000,
    );

    const awaitConfirmation = async (
      attempt: number,
    ): Promise<ConfirmationOutcome> => {
      if (attempt > MAX_REPLY_ATTEMPTS) {
        return { status: 'exhausted' };
      }

      const reply = await step.waitForEvent(
        `wait-for-confirmation-${attempt}`,
        {
          event: smsInboundReceived.name,
          match: 'data.from',
          timeout: new Date(replyDeadline),
        },
      );

      if (!reply) {
        return { status: 'timed_out' };
      }

      const { code } = smsInboundReceived.schema.parse(reply.data);

      if (!code) {
        logger.info('Reply did not look like a signup code', { attempt });
        return awaitConfirmation(attempt + 1);
      }

      const confirmation = await step.run(
        `confirm-signup-code-${attempt}`,
        () => confirmPhoneSignupCode({ phone: to, token: code }),
      );

      if (confirmation.status === 'rejected') {
        logger.info('GoTrue rejected the signup code', {
          attempt,
          reason: confirmation.reason,
        });
        return awaitConfirmation(attempt + 1);
      }

      return confirmation;
    };

    const outcome = await awaitConfirmation(1);

    if (outcome.status === 'timed_out') {
      logger.info('No confirmation reply received in time');
      return { message: 'timed out waiting for confirmation' };
    }

    if (outcome.status === 'exhausted') {
      logger.info('No valid signup code in the allowed replies', {
        attempts: MAX_REPLY_ATTEMPTS,
      });
      return { message: 'code not confirmed', attempts: MAX_REPLY_ATTEMPTS };
    }

    const { authUserId } = outcome;

    const welcomeResult = await step.run('send-welcome-reply', async () => {
      const result = await sendSms({
        to,
        body: "You're in! Welcome to Common.",
      });
      if (result.status === 'rejected' && result.retryable) {
        throw new RateLimitError(
          `Welcome message send rejected: ${result.reason}`,
        );
      }
      return result;
    });

    if (welcomeResult.status === 'rejected') {
      logger.warn('Welcome message permanently rejected', {
        authUserId,
        reason: welcomeResult.reason,
      });
    }

    const profileId = await step.run('lookup-profile-id', async () => {
      const confirmedState = await getPhoneSignupState({ phone: to });
      return confirmedState.status === 'confirmed'
        ? confirmedState.profileId
        : null;
    });

    logger.info('Created account from inbound SMS signup', {
      authUserId,
      profileId,
    });

    return { message: 'account created', authUserId };
  },
);
