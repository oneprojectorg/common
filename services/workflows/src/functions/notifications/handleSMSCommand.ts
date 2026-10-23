import { isFeatureEnabled } from '@op/analytics';
import {
  findChatLine,
  getGeocoder,
  getPhoneSignupState,
  parsePhoneNumber,
} from '@op/common';
import { assertNever } from '@op/core';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import {
  type SmsDeliver,
  agree,
  freeText,
  info,
  join,
  more,
  proposals,
  show,
  vote,
} from './smsCommandHandlers';
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

const SMS_COMMANDS_FEATURE_FLAG = 'sms-commands';
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
    const {
      from,
      to: inboundTo,
      keyword,
      argument,
      code,
      body,
    } = smsInboundReceived.schema.parse(event.data);

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

    const line = await step.run('resolve-line', async () => {
      const found = inboundTo ? await findChatLine({ phone: inboundTo }) : null;
      return found
        ? { phone: found.phone, slug: found.slug, instanceId: found.instanceId }
        : null;
    });

    const text = createTextSender({
      step,
      to,
      from: line ? parsePhoneNumber(line.phone) : undefined,
      purpose: 'answer an SMS command',
      context: { keyword, onLine: line !== null },
    });

    if (!text) {
      return SMS_UNAVAILABLE_RESULT;
    }

    const deliver: SmsDeliver = async (stepId, label, message) => {
      const sent = await text(stepId, label, message);
      if (sent.status !== 'rejected') {
        return null;
      }
      logger.warn('SMS command reply permanently rejected', {
        keyword,
        reason: sent.reason,
      });
      return { message: 'reply rejected', reason: sent.reason };
    };

    const context = {
      step,
      account,
      argument,
      body,
      line: line ? { slug: line.slug, instanceId: line.instanceId } : null,
      deliver,
      geocode: getGeocoder(),
    };

    switch (keyword) {
      case null:
        return freeText(context);
      case 'join':
        return join(context);
      case 'show':
        return show(context);
      case 'vote':
        return vote(context);
      case 'agree':
        return agree(context);
      case 'proposals':
        return proposals(context);
      case 'more':
        return more(context);
      case 'info':
        return info(context);
      default:
        return assertNever(keyword);
    }
  },
);
