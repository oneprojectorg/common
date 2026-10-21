import { isFeatureEnabled } from '@op/analytics';
import {
  NotFoundError,
  UnauthorizedError,
  clipSmsText,
  formatSmsDecisionInfo,
  formatSmsDecisionList,
  getPhoneSignupState,
  getSmsDecisionDescription,
  listSmsDecisions,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import {
  SMS_THROTTLE_LIMIT,
  SMS_THROTTLE_PERIOD,
  smsNumberRateLimit,
} from './smsInboundLimits';
import {
  INVALID_PHONE_RESULT,
  SMS_ALREADY_JOINED_MESSAGE,
  SMS_COMMAND_HELP_MESSAGE,
  SMS_UNAVAILABLE_RESULT,
  createTextSender,
  parseInboundNumber,
} from './smsReply';

const SMS_COMMANDS_FEATURE_FLAG = 'sms-commands';
const SMS_SLUG_LENGTH = 100;
const { smsInboundReceived } = Events;

export const handleSMSCommand = inngest.createFunction(
  {
    id: 'handleSMSCommand',
    rateLimit: smsNumberRateLimit('event.data.from'),
    throttle: {
      limit: SMS_THROTTLE_LIMIT,
      period: SMS_THROTTLE_PERIOD,
    },
    concurrency: { key: 'event.data.from', limit: 1 },
  },
  { event: smsInboundReceived.name },
  async ({ event, step }) => {
    const { from, keyword, argument, code } = smsInboundReceived.schema.parse(
      event.data,
    );

    if (code !== null) {
      return { message: 'signup code, left to signup' };
    }

    const flagEnabled = await step.run('check-feature-flag', () =>
      isFeatureEnabled(SMS_COMMANDS_FEATURE_FLAG, 'server'),
    );

    if (!flagEnabled) {
      logger.info('SMS commands feature flag is disabled, skipping');
      return { message: 'sms commands disabled' };
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

    const deliver = async (stepId: string, label: string, body: string) => {
      const sent = await text(stepId, label, body);
      if (sent.status !== 'rejected') {
        return null;
      }
      logger.warn('SMS command reply permanently rejected', {
        keyword,
        reason: sent.reason,
      });
      return { message: 'reply rejected' as const, reason: sent.reason };
    };

    const listDecisions = async () => {
      const decisions = await step.run('list-decisions', () =>
        listSmsDecisions({ authUserId: account.authUserId }),
      );
      const bodies = formatSmsDecisionList(decisions);
      for (const [index, body] of bodies.entries()) {
        const failed = await deliver(
          index === 0
            ? 'send-decision-list'
            : `send-decision-list-${index + 1}`,
          'Decision list',
          body,
        );
        if (failed) {
          return failed;
        }
      }
      return { message: 'decisions sent', count: decisions.length };
    };

    const show = async () => {
      if (!argument) {
        return listDecisions();
      }

      const decision = await step.run('describe-decision', async () => {
        try {
          return await getSmsDecisionDescription({
            authUserId: account.authUserId,
            decisionSlug: argument,
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
        const failed = await deliver(
          'send-not-found-reply',
          'Not-found reply',
          `No decision named "${clipSmsText(argument, SMS_SLUG_LENGTH)}" was found.`,
        );
        return failed ?? { message: 'decision not found' };
      }

      const failed = await deliver(
        'send-decision-reply',
        'Decision reply',
        formatSmsDecisionInfo(decision),
      );
      return failed ?? { message: 'decision sent' };
    };

    switch (keyword) {
      case 'join': {
        const failed = await deliver(
          'send-already-joined-reply',
          'Already joined reply',
          SMS_ALREADY_JOINED_MESSAGE,
        );
        return failed ?? { message: 'already joined' };
      }
      case 'show':
        return show();
      default: {
        const failed = await deliver(
          'send-help-reply',
          'Help reply',
          SMS_COMMAND_HELP_MESSAGE,
        );
        return failed ?? { message: 'help sent' };
      }
    }
  },
);
