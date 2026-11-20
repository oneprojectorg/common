import { isFeatureEnabled } from '@op/analytics';
import {
  findDecisionPhoneNumber,
  getGeocoder,
  getPhoneSignupState,
  parsePhoneNumber,
  recordSmsMessage,
} from '@op/common';
import { assertNever } from '@op/core';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import {
  type SmsDeliver,
  agree,
  ask,
  done,
  freeText,
  info,
  infoHelp,
  list,
  more,
  move,
  proposals,
  remove,
  show,
  submit,
  vote,
} from './smsCommandHandlers';
import {
  SMS_THROTTLE_LIMIT,
  SMS_THROTTLE_PERIOD,
  smsNumberRateLimit,
} from './smsInboundLimits';
import {
  INVALID_PHONE_RESULT,
  SMS_COMMANDS_FEATURE_FLAG,
  SMS_UNAVAILABLE_RESULT,
  createTextSender,
  parseInboundNumber,
} from './smsReply';

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
      body,
      messageSid,
      authUserId: accountAtReceipt,
    } = smsInboundReceived.schema.parse(event.data);

    const to = parseInboundNumber(from, 'command');

    const resolved = await step.run('resolve-context', async () => {
      const flagEnabled = await isFeatureEnabled(
        SMS_COMMANDS_FEATURE_FLAG,
        'server',
      );
      if (!flagEnabled || !to) {
        return { flagEnabled, account: null, line: null };
      }
      // The webhook resolves the account once at receipt. An event recorded
      // before the field existed falls back to a live read.
      const [state, found] = await Promise.all([
        accountAtReceipt === undefined
          ? getPhoneSignupState({ phone: to })
          : null,
        inboundTo ? findDecisionPhoneNumber({ phone: inboundTo }) : null,
      ]);
      const accountId =
        accountAtReceipt === undefined
          ? state?.status === 'confirmed'
            ? state.authUserId
            : null
          : accountAtReceipt;
      return {
        flagEnabled,
        account: accountId ? { authUserId: accountId } : null,
        line: found
          ? {
              id: found.id,
              phone: found.phone,
              slug: found.slug,
              instanceId: found.instanceId,
            }
          : null,
      };
    });

    if (!resolved.flagEnabled) {
      logger.info('SMS commands feature flag is disabled, skipping');
      return { message: 'sms commands disabled' };
    }

    if (!to) {
      return INVALID_PHONE_RESULT;
    }

    const { account, line } = resolved;

    const inboundSmsId = await step.run('record-inbound-sms', async () => {
      // A log failure must not fail the function: the command still answers.
      try {
        const message = await recordSmsMessage({
          direction: 'inbound',
          body: body ?? [keyword, argument].filter(Boolean).join(' '),
          phoneNumberId: line?.id ?? null,
          authUserId: account?.authUserId ?? null,
          counterpartE164: to,
          providerSid: messageSid,
        });
        return message.id;
      } catch (error) {
        logger.error('Inbound SMS could not be logged', { error });
        return null;
      }
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
      from: line ? parsePhoneNumber(line.phone) : undefined,
      purpose: 'answer an SMS command',
      context: { keyword, onLine: line !== null },
      authUserId: account.authUserId,
      phoneNumberId: line?.id ?? null,
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
      line: line
        ? { id: line.id, slug: line.slug, instanceId: line.instanceId }
        : null,
      deliver,
      geocode: getGeocoder(),
      inboundSmsId,
    };

    switch (keyword) {
      case null:
        return freeText(context);
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
      case 'info-help':
        return infoHelp(context);
      case 'list':
        return list(context);
      case 'done':
        return done(context);
      case 'submit':
        return submit(context);
      case 'remove':
        return remove(context);
      case 'move':
        return move(context);
      case 'l':
        return ask(context);
      default:
        return assertNever(keyword);
    }
  },
);
