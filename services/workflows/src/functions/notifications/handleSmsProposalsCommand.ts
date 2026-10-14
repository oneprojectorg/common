import {
  RateLimitError,
  findSmsDecision,
  formatSmsProposalPages,
  getPhoneSignupState,
  getSmsProvider,
  listSmsBallotProposals,
  safeParsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { smsNumberRateLimit } from './smsInboundLimits';

const HELP_MESSAGE =
  'Text PROPOSALS followed by the decision name, for example PROPOSALS columbus.';
const { smsInboundReceived } = Events;

export const handleSmsProposalsCommand = inngest.createFunction(
  {
    id: 'handleSmsProposalsCommand',
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
  {
    event: smsInboundReceived.name,
    if: 'event.data.keyword == "proposals" && event.data.argument != null',
  },
  async ({ event, step }) => {
    const { from, argument } = smsInboundReceived.schema.parse(event.data);

    const parsedFrom = safeParsePhoneNumber(from);

    if (!parsedFrom.success) {
      logger.info('PROPOSALS command from a non-E.164 number, skipping', {
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
      logger.info('PROPOSALS command from a number with no account, skipping');
      return { message: 'unknown number, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot answer a PROPOSALS command: no Twilio Messaging Service configured',
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;

    const text = (stepId: string, body: string) =>
      step.run(stepId, async () => {
        const result = await sendSms({ to, body });
        if (result.status === 'rejected' && result.retryable) {
          throw new RateLimitError(`Proposals text rejected: ${result.reason}`);
        }
        return result;
      });

    if (!argument) {
      await text('send-help-reply', HELP_MESSAGE);
      return { message: 'help sent' };
    }

    const decision = await step.run('find-decision', () =>
      findSmsDecision({ authUserId: account.authUserId, slug: argument }),
    );

    if (!decision) {
      await text(
        'send-not-found-reply',
        `No decision named "${argument}" was found.`,
      );
      return { message: 'decision not found' };
    }

    const proposals = await step.run('list-proposals', () =>
      listSmsBallotProposals({ processInstanceId: decision.processInstanceId }),
    );

    if (proposals.length === 0) {
      await text(
        'send-empty-reply',
        `"${decision.name}" has no proposals yet.`,
      );
      return { message: 'no proposals', pages: 0 };
    }

    const bodies = formatSmsProposalPages({
      decisionName: decision.name,
      slug: decision.slug,
      proposals,
    });

    for (const [index, body] of bodies.entries()) {
      await text(`send-page-${index + 1}`, body);
    }

    return { message: 'proposals sent', pages: bodies.length };
  },
);
