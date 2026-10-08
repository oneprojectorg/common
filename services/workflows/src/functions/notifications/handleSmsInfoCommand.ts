import {
  RateLimitError,
  findSmsDecision,
  formatSmsProposalInfo,
  getPhoneSignupState,
  getSmsProvider,
  listSmsBallotProposals,
  safeParsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const INFO_ARGUMENT_PATTERN = /^(.+?)\s+(\d{3})$/;
const { smsInboundReceived } = Events;

export const handleSmsInfoCommand = inngest.createFunction(
  {
    id: 'handleSmsInfoCommand',
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
    if: 'event.data.keyword == "info" && event.data.argument != null',
  },
  async ({ event, step }) => {
    const { from, argument } = smsInboundReceived.schema.parse(event.data);

    const parsedFrom = safeParsePhoneNumber(from);

    if (!parsedFrom.success) {
      logger.info('INFO command from a non-E.164 number, skipping', {
        reason: parsedFrom.error.message,
      });
      return { message: 'invalid phone number' };
    }

    const to = parsedFrom.data;
    const match = argument ? INFO_ARGUMENT_PATTERN.exec(argument) : null;
    const slug = match?.[1] ?? null;
    const code = match?.[2] ?? null;

    if (!slug || !code) {
      return { message: 'not a decision and code, skipped' };
    }

    const account = await step.run('resolve-account', async () => {
      const state = await getPhoneSignupState({ phone: to });
      return state.status === 'confirmed'
        ? { authUserId: state.authUserId }
        : null;
    });

    if (!account) {
      logger.info('INFO command from a number with no account, skipping');
      return { message: 'unknown number, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot answer an INFO command: no Twilio Messaging Service configured',
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;

    const text = (stepId: string, body: string) =>
      step.run(stepId, async () => {
        const result = await sendSms({ to, body });
        if (result.status === 'rejected' && result.retryable) {
          throw new RateLimitError(`Info text rejected: ${result.reason}`);
        }
        return result;
      });

    const decision = await step.run('find-decision', () =>
      findSmsDecision({ authUserId: account.authUserId, slug }),
    );

    if (!decision) {
      await text(
        'send-not-found-reply',
        `No decision named "${slug}" was found.`,
      );
      return { message: 'decision not found' };
    }

    const proposal = await step.run('find-proposal', async () => {
      const proposals = await listSmsBallotProposals({
        processInstanceId: decision.processInstanceId,
      });
      return proposals.find((candidate) => candidate.code === code) ?? null;
    });

    if (!proposal) {
      await text(
        'send-no-proposal-reply',
        `No proposal with code ${code} in "${decision.name}". Text PROPOSALS ${decision.slug} to browse.`,
      );
      return { message: 'proposal not found' };
    }

    await text('send-info-reply', formatSmsProposalInfo(proposal));

    return { message: 'info sent' };
  },
);
