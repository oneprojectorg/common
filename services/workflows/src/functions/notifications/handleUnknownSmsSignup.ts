import { isFeatureEnabled } from '@op/analytics';
import {
  type PhoneSignupConfirmation,
  confirmPhoneSignupCode,
  discardUnconfirmedPhoneSignup,
  getPhoneSignupState,
  PHONE_SIGNUP_REPLY_WINDOW_MINUTES,
  requestPhoneSignupCode,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { remainingReplyWindow } from './replyWindow';
import {
  SMS_THROTTLE_LIMIT,
  SMS_THROTTLE_PERIOD,
  smsNumberRateLimit,
} from './smsInboundLimits';
import {
  INVALID_PHONE_RESULT,
  SMS_UNAVAILABLE_RESULT,
  createTextSender,
  parseInboundNumber,
} from './smsReply';

const SMS_SIGNUP_FEATURE_FLAG = 'sms-signup';
const MAX_REPLY_ATTEMPTS = 3;
const DEBOUNCE_PERIOD = '5s';
const REPLY_WINDOW_MS = PHONE_SIGNUP_REPLY_WINDOW_MINUTES * 60_000;
const HELP_MESSAGE =
  'Text JOIN to sign up. Reply STOP to unsubscribe. Msg&Data Rates May Apply.';
const CONSENT_MESSAGE =
  'Reply with the code we just texted you to create your Common account.';
const WELCOME_MESSAGE = "You're in! Welcome to Common.";
const { smsInboundReceived } = Events;

type ConfirmationOutcome =
  | Extract<PhoneSignupConfirmation, { status: 'confirmed' }>
  | { status: 'timed_out' }
  | { status: 'exhausted' };

export const handleUnknownSmsSignup = inngest.createFunction(
  {
    id: 'handleUnknownSmsSignup',
    rateLimit: smsNumberRateLimit('event.data.from'),
    throttle: {
      limit: SMS_THROTTLE_LIMIT,
      period: SMS_THROTTLE_PERIOD,
    },
    debounce: {
      key: 'event.data.from',
      period: DEBOUNCE_PERIOD,
    },
    singleton: {
      key: 'event.data.from',
      mode: 'skip',
    },
  },
  { event: smsInboundReceived.name },
  async ({ event, step }) => {
    const { from, keyword } = smsInboundReceived.schema.parse(event.data);

    logger.info('SMS Signup trigger');

    const flagEnabled = await step.run('check-feature-flag', () =>
      isFeatureEnabled(SMS_SIGNUP_FEATURE_FLAG, 'server'),
    );

    if (!flagEnabled) {
      logger.info('SMS signup feature flag is disabled, skipping');
      return { message: 'sms signup disabled' };
    }

    const to = parseInboundNumber(from, 'signup');

    if (!to) {
      return INVALID_PHONE_RESULT;
    }

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

    const sendText = createTextSender({
      step,
      to,
      purpose: 'start SMS signup',
    });

    if (!sendText) {
      return SMS_UNAVAILABLE_RESULT;
    }

    if (keyword !== 'join') {
      const helpResult = await sendText(
        'send-help-reply',
        'Help reply',
        HELP_MESSAGE,
      );

      if (helpResult.status === 'rejected') {
        logger.warn('Help reply permanently rejected', {
          reason: helpResult.reason,
        });
        return { message: 'help send rejected', reason: helpResult.reason };
      }

      logger.info('Inbound SMS from an unknown number was not JOIN, sent help');
      return { message: 'help sent' };
    }

    const discardAbandonedSignup = (codeSentNoLaterThan: number) =>
      step.run('discard-abandoned-signup', () =>
        discardUnconfirmedPhoneSignup({
          phone: to,
          codeSentNoLaterThan: new Date(codeSentNoLaterThan),
        }),
      );

    const codeRequest = await step.run('request-signup-code', () =>
      requestPhoneSignupCode({ phone: to }),
    );

    if (codeRequest.status === 'rejected') {
      logger.warn('GoTrue refused to send a signup code, aborting signup', {
        reason: codeRequest.reason,
      });
      return { message: 'code send rejected', reason: codeRequest.reason };
    }

    const codeSentAt = await step.run('read-code-sent-at', async () => {
      const attempt = await getPhoneSignupState({ phone: to });
      return attempt.status === 'attempt_in_progress'
        ? attempt.codeSentAt.getTime()
        : Date.now();
    });

    const consentResult = await sendText(
      'send-consent-request',
      'Consent request',
      CONSENT_MESSAGE,
    );

    if (consentResult.status === 'rejected') {
      logger.warn('Consent request permanently rejected, aborting signup', {
        reason: consentResult.reason,
      });
      const discard = await discardAbandonedSignup(codeSentAt);
      return {
        message: 'consent send rejected',
        reason: consentResult.reason,
        discard: discard.status,
      };
    }

    const replyDeadline = await step.run(
      'start-reply-window',
      () => Date.now() + REPLY_WINDOW_MS,
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
          timeout: remainingReplyWindow(replyDeadline),
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
      const discard = await discardAbandonedSignup(codeSentAt);
      return {
        message: 'timed out waiting for confirmation',
        discard: discard.status,
      };
    }

    if (outcome.status === 'exhausted') {
      logger.info('No valid signup code in the allowed replies', {
        attempts: MAX_REPLY_ATTEMPTS,
      });
      const discard = await discardAbandonedSignup(codeSentAt);
      return {
        message: 'code not confirmed',
        attempts: MAX_REPLY_ATTEMPTS,
        discard: discard.status,
      };
    }

    const { authUserId } = outcome;

    const welcomeResult = await sendText(
      'send-welcome-reply',
      'Welcome message',
      WELCOME_MESSAGE,
    );

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
