import { isFeatureEnabled } from '@op/analytics';
import {
  createAccountFromPhone,
  getSmsProvider,
  parsePhoneNumber,
  RateLimitError,
  type PhoneNumber,
  ValidationError,
} from '@op/common';
import { db } from '@op/db/client';
import { authUsers, users } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const CONFIRMATION_KEYWORD = 'YES';
const SMS_SIGNUP_FEATURE_FLAG = 'sms-signup';
const { smsInboundReceived } = Events;

export const handleUnknownSmsSignup = inngest.createFunction(
  {
    id: 'handleUnknownSmsSignup',
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

    const flagEnabled = await step.run('check-feature-flag', () =>
      isFeatureEnabled(SMS_SIGNUP_FEATURE_FLAG, 'server'),
    );

    if (!flagEnabled) {
      logger.info('SMS signup feature flag is disabled, skipping');
      return { message: 'sms signup disabled' };
    }

    const existing = await step.run(
      'check-known-number',
      async (): Promise<{
        authUserId: string;
        profileId: string | null;
      } | null> => {
        const [row] = await db
          .select({ authUserId: authUsers.id, profileId: users.profileId })
          .from(authUsers)
          .leftJoin(users, eq(users.authUserId, authUsers.id))
          .where(eq(authUsers.phone, from))
          .limit(1);
        return row ?? null;
      },
    );

    if (existing) {
      logger.info('Inbound SMS from a known number, skipping signup flow', {
        profileId: existing.profileId,
      });
      return { message: 'known number, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot start SMS signup: no Twilio Messaging Service configured',
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;

    let to: PhoneNumber;
    try {
      to = parsePhoneNumber(from);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.info('Inbound SMS from a non-E.164 number, skipping signup', {
          reason: error.message,
        });
        return { message: 'invalid phone number' };
      }
      throw error;
    }

    const consentResult = await step.run('send-consent-request', async () => {
      const result = await sendSms({
        to,
        body: `Reply ${CONFIRMATION_KEYWORD} to create your Common account.`,
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

    const reply = await step.waitForEvent('wait-for-confirmation', {
      event: smsInboundReceived.name,
      match: 'data.from',
      timeout: '10m',
    });

    if (!reply) {
      logger.info('No confirmation reply received in time');
      return { message: 'timed out waiting for confirmation' };
    }

    const { body: replyBody } = smsInboundReceived.schema.parse(reply.data);

    if (replyBody.trim().toUpperCase() !== CONFIRMATION_KEYWORD) {
      logger.info('Reply did not match the confirmation keyword');
      return { message: 'reply did not confirm' };
    }

    const { authUserId } = await step.run('create-account', () =>
      createAccountFromPhone({ phone: to }),
    );

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
      const [row] = await db
        .select({ profileId: users.profileId })
        .from(users)
        .where(eq(users.authUserId, authUserId))
        .limit(1);
      return row?.profileId ?? null;
    });

    logger.info('Created account from inbound SMS signup', {
      authUserId,
      profileId,
    });

    return { message: 'account created', authUserId };
  },
);
