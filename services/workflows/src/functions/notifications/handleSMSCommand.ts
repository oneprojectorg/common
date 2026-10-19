import {
  NotFoundError,
  UnauthorizedError,
  clipSmsText,
  countBallotProposals,
  formatSmsDecisionInfo,
  formatSmsDecisionList,
  getPhoneSignupState,
  getPublishedDecisionBySlug,
  listSmsDecisions,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { smsNumberRateLimit } from './smsInboundLimits';
import {
  INVALID_PHONE_RESULT,
  SMS_COMMAND_HELP_MESSAGE,
  SMS_UNAVAILABLE_RESULT,
  createTextSender,
  parseInboundNumber,
} from './smsReply';

const SMS_SLUG_LENGTH = 100;
const { smsInboundReceived } = Events;

export const handleSMSCommand = inngest.createFunction(
  {
    id: 'handleSMSCommand',
    rateLimit: smsNumberRateLimit('event.data.from'),
    debounce: {
      key: 'event.data.from',
      period: '5s',
    },
    singleton: {
      key: 'event.data.from',
      mode: 'skip',
    },
  },
  { event: smsInboundReceived.name },
  async ({ event, step }) => {
    const { from, keyword, argument, code } = smsInboundReceived.schema.parse(
      event.data,
    );

    if (code !== null) {
      return { message: 'signup code, left to signup' };
    }

    const to = parseInboundNumber(from, 'command');

    if (!to) {
      return INVALID_PHONE_RESULT;
    }

    const account = await step.run('resolve-account', async () => {
      const state = await getPhoneSignupState({ phone: to });
      return state.status === 'confirmed'
        ? { authUserId: state.authUserId }
        : null;
    });

    if (!account) {
      logger.info('SMS command from a number with no account, skipping', {
        keyword,
      });
      return { message: 'unknown number, skipped' };
    }

    const text = createTextSender({
      step,
      to,
      purpose: 'answer an SMS command',
      context: { keyword },
    });

    if (!text) {
      return SMS_UNAVAILABLE_RESULT;
    }

    const listDecisions = async () => {
      const decisions = await step.run('list-decisions', () =>
        listSmsDecisions({ authUserId: account.authUserId }),
      );
      const bodies = formatSmsDecisionList(decisions);
      for (const [index, body] of bodies.entries()) {
        await text(
          index === 0
            ? 'send-decision-list'
            : `send-decision-list-${index + 1}`,
          'Decision list',
          body,
        );
      }
      return { message: 'decisions sent', count: decisions.length };
    };

    const show = async () => {
      if (!argument) {
        return listDecisions();
      }

      const decision = await step.run('find-decision', async () => {
        try {
          return await getPublishedDecisionBySlug({
            authUserId: account.authUserId,
            slug: argument,
          });
        } catch (error) {
          if (
            error instanceof NotFoundError ||
            error instanceof UnauthorizedError
          ) {
            return null;
          }
          throw error;
        }
      });

      if (!decision) {
        await text(
          'send-not-found-reply',
          'Not-found reply',
          `No decision named "${clipSmsText(argument, SMS_SLUG_LENGTH)}" was found.`,
        );
        return { message: 'decision not found' };
      }

      const proposalCount = await step.run('count-proposals', () =>
        countBallotProposals({
          processInstanceId: decision.processInstanceId,
        }),
      );

      await text(
        'send-decision-reply',
        'Decision reply',
        formatSmsDecisionInfo({ ...decision, proposalCount }),
      );
      return { message: 'decision sent' };
    };

    switch (keyword) {
      case 'join':
        return { message: 'join is handled by signup' };
      case 'show':
        return show();
      default:
        await text('send-help-reply', 'Help reply', SMS_COMMAND_HELP_MESSAGE);
        return { message: 'help sent' };
    }
  },
);
