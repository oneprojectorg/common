import {
  RateLimitError,
  findSmsDecision,
  formatSmsProposalInfo,
  getPhoneSignupState,
  getSmsProvider,
  listSmsBallotProposals,
  safeParsePhoneNumber,
} from '@op/common';
import { SMS_PROPOSAL_CODE } from '@op/core/sms';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { smsNumberRateLimit } from './smsInboundLimits';

const HELP_MESSAGE =
  'Text INFO, the decision name and a proposal code, for example INFO columbus 102. Reply STOP to unsubscribe.';
const INFO_ARGUMENT_PATTERN = new RegExp(`^(.+?)\\s+(${SMS_PROPOSAL_CODE})$`);
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
    const { from, keyword, argument } = smsInboundReceived.schema.parse(
      event.data,
    );

    const parsedFrom = safeParsePhoneNumber(from);

    if (!parsedFrom.success) {
      logger.info('SMS command from a non-E.164 number, skipping', {
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
      logger.info('SMS command from a number with no account, skipping', {
        keyword,
      });
      return { message: 'unknown number, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot answer an SMS command: no Twilio Messaging Service configured',
        { keyword },
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;

    const text = (stepId: string, body: string) =>
      step.run(stepId, async () => {
        const result = await sendSms({ to, body });
        if (result.status === 'rejected' && result.retryable) {
          throw new RateLimitError(`SMS reply rejected: ${result.reason}`);
        }
        return result;
      });

    const help = async () => {
      await text('send-help-reply', HELP_MESSAGE);
      return { message: 'help sent' };
    };

    const info = async () => {
      const match = argument ? INFO_ARGUMENT_PATTERN.exec(argument) : null;
      const slug = match?.[1];
      const code = match?.[2];

      if (!slug || !code) {
        return help();
      }

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
          `No proposal with code ${code} in "${decision.name}".`,
        );
        return { message: 'proposal not found' };
      }

      await text('send-info-reply', formatSmsProposalInfo(proposal));
      return { message: 'info sent' };
    };

    switch (keyword) {
      case 'join':
        return { message: 'join is handled by signup' };
      case 'info':
        return info();
      default:
        return help();
    }
  },
);
