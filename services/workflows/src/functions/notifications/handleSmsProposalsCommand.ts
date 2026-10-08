import {
  RateLimitError,
  SMS_PROPOSALS_PAGE_SIZE,
  findSmsDecision,
  formatSmsProposalPage,
  getPhoneSignupState,
  getSmsProvider,
  listSmsBallotProposals,
  safeParsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const HELP_MESSAGE =
  'Text PROPOSALS followed by the decision name, for example PROPOSALS columbus.';
const MORE_TIMEOUT = '10m';
const { smsInboundReceived } = Events;

export const handleSmsProposalsCommand = inngest.createFunction(
  {
    id: 'handleSmsProposalsCommand',
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

    const pageCount = Math.ceil(proposals.length / SMS_PROPOSALS_PAGE_SIZE);

    for (let page = 0; page < pageCount; page++) {
      const { body, hasMore } = formatSmsProposalPage({
        decisionName: decision.name,
        proposals,
        page,
      });
      await text(`send-page-${page + 1}`, body);

      if (!hasMore) {
        return { message: 'proposals sent', pages: page + 1 };
      }

      const more = await step.waitForEvent(`wait-for-more-${page + 1}`, {
        event: smsInboundReceived.name,
        if: 'event.data.from == async.data.from && async.data.keyword == "more"',
        timeout: MORE_TIMEOUT,
      });

      if (!more) {
        return { message: 'proposals sent', pages: page + 1 };
      }
    }

    return { message: 'proposals sent', pages: pageCount };
  },
);
