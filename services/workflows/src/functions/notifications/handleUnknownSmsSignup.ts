import {
  createAccountFromPhone,
  getSmsProvider,
  parsePhoneNumber,
} from '@op/common';
import { db } from '@op/db/client';
import { authUsers } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const CONFIRMATION_KEYWORD = 'YES';
const { smsInboundReceived } = Events;

export const handleUnknownSmsSignup = inngest.createFunction(
  {
    id: 'handleUnknownSmsSignup',
    debounce: {
      key: 'event.data.from',
      period: '1m',
    },
  },
  { event: smsInboundReceived.name },
  async ({ event, step }) => {
    const { from } = smsInboundReceived.schema.parse(event.data);

    const existing = await step.run('check-known-number', async () => {
      const [row] = await db
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(eq(authUsers.phone, from))
        .limit(1);
      return row ?? null;
    });

    if (existing) {
      logger.info('Inbound SMS from a known number, skipping signup flow', {
        from,
      });
      return { message: 'known number, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot start SMS signup: no Twilio Messaging Service configured',
        { from },
      );
      return { message: 'sms sending unavailable' };
    }

    const to = parsePhoneNumber(from);

    await step.run('send-consent-request', async () => {
      const result = await provider.sendSms!({
        to,
        body: `Reply ${CONFIRMATION_KEYWORD} to create your Common account.`,
      });
      if (result.status === 'rejected') {
        logger.warn('Consent request send rejected', {
          from,
          reason: result.reason,
        });
      }
    });

    const reply = await step.waitForEvent('wait-for-confirmation', {
      event: smsInboundReceived.name,
      match: 'data.from',
      timeout: '10m',
    });

    if (!reply) {
      logger.info('No confirmation reply received in time', { from });
      return { message: 'timed out waiting for confirmation' };
    }

    const { body: replyBody } = smsInboundReceived.schema.parse(reply.data);

    if (replyBody.trim().toUpperCase() !== CONFIRMATION_KEYWORD) {
      logger.info('Reply did not match the confirmation keyword', { from });
      return { message: 'reply did not confirm' };
    }

    const { authUserId } = await step.run('create-account', () =>
      createAccountFromPhone({ phone: to }),
    );

    await step.run('send-welcome-reply', async () => {
      await provider.sendSms!({
        to,
        body: "You're in! Welcome to Common.",
      });
    });

    logger.info('Created account from inbound SMS signup', {
      from,
      authUserId,
    });

    return { message: 'account created', authUserId };
  },
);
