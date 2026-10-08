import {
  RateLimitError,
  getPhoneSignupState,
  findSmsDecision,
  getSmsProvider,
  safeParsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const HELP_MESSAGE =
  'Text SHOW followed by the decision name, for example SHOW columbus.';
const { smsInboundReceived } = Events;

export const handleSmsShowCommand = inngest.createFunction(
  {
    id: 'handleSmsShowCommand',
    debounce: {
      key: 'event.data.from',
      period: '5s',
    },
    singleton: {
      key: 'event.data.from',
      mode: 'skip',
    },
  },
  { event: smsInboundReceived.name, if: 'event.data.keyword == "show"' },
  async ({ event, step }) => {
    const { from, argument } = smsInboundReceived.schema.parse(event.data);

    const parsedFrom = safeParsePhoneNumber(from);

    if (!parsedFrom.success) {
      logger.info('SHOW command from a non-E.164 number, skipping', {
        reason: parsedFrom.error.message,
      });
      return { message: 'invalid phone number' };
    }

    const to = parsedFrom.data;

    const account = await step.run('resolve-account', async () => {
      const state = await getPhoneSignupState({ phone: to });
      return state.status === 'confirmed'
        ? { authUserId: state.authUserId }
        : null;
    });

    if (!account) {
      logger.info('SHOW command from a number with no account, skipping');
      return { message: 'unknown number, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot answer a SHOW command: no Twilio Messaging Service configured',
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;

    const text = (stepId: string, label: string, body: string) =>
      step.run(stepId, async () => {
        const result = await sendSms({ to, body });
        if (result.status === 'rejected' && result.retryable) {
          throw new RateLimitError(`${label} send rejected: ${result.reason}`);
        }
        return result;
      });

    if (!argument) {
      await text('send-help-reply', 'Help reply', HELP_MESSAGE);
      return { message: 'help sent' };
    }

    const link = await step.run('find-decision', () =>
      findSmsDecision({ authUserId: account.authUserId, slug: argument }),
    );

    if (!link) {
      await text(
        'send-not-found-reply',
        'Not found reply',
        `No decision named "${argument}" was found.`,
      );
      return { message: 'decision not found' };
    }

    await text(
      'send-decision-link',
      'Decision link',
      `${link.name}: ${link.url}`,
    );

    logger.info('Answered a SHOW command', { authUserId: account.authUserId });

    return { message: 'link sent' };
  },
);
