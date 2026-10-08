import {
  RateLimitError,
  formatSmsDecisionList,
  getPhoneSignupState,
  getSmsProvider,
  listSmsDecisions,
  safeParsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { smsInboundReceived } = Events;

export const handleSmsDecisionsCommand = inngest.createFunction(
  {
    id: 'handleSmsDecisionsCommand',
    debounce: {
      key: 'event.data.from',
      period: '5s',
    },
    singleton: {
      key: 'event.data.from',
      mode: 'skip',
    },
  },
  { event: smsInboundReceived.name, if: 'event.data.keyword == "decisions"' },
  async ({ event, step }) => {
    const { from } = smsInboundReceived.schema.parse(event.data);

    const parsedFrom = safeParsePhoneNumber(from);

    if (!parsedFrom.success) {
      logger.info('DECISIONS command from a non-E.164 number, skipping', {
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
      logger.info('DECISIONS command from a number with no account, skipping');
      return { message: 'unknown number, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot answer a DECISIONS command: no Twilio Messaging Service configured',
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;

    const decisions = await step.run('list-decisions', () =>
      listSmsDecisions({ authUserId: account.authUserId }),
    );

    const listResult = await step.run('send-decision-list', async () => {
      const result = await sendSms({
        to,
        body: formatSmsDecisionList(decisions),
      });
      if (result.status === 'rejected' && result.retryable) {
        throw new RateLimitError(
          `Decision list send rejected: ${result.reason}`,
        );
      }
      return result;
    });

    if (listResult.status === 'rejected') {
      logger.warn('Decision list permanently rejected', {
        authUserId: account.authUserId,
        reason: listResult.reason,
      });
      return { message: 'list send rejected', reason: listResult.reason };
    }

    logger.info('Answered a DECISIONS command', {
      authUserId: account.authUserId,
      count: decisions.length,
    });

    return { message: 'list sent', count: decisions.length };
  },
);
