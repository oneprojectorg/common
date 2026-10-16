import {
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  countBallotProposals,
  formatSmsDecisionInfo,
  getPhoneSignupState,
  getPublishedDecisionBySlug,
  getSmsProvider,
  isVotingPhase,
  safeParsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { smsNumberRateLimit } from './smsInboundLimits';

const HELP_MESSAGE =
  'Text INFO and the decision name, for example INFO columbus. Reply STOP to unsubscribe.';
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
      if (!argument) {
        return help();
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
          `No decision named "${argument}" was found.`,
        );
        return { message: 'decision not found' };
      }

      const proposalCount = await step.run('count-proposals', () =>
        countBallotProposals({
          processInstanceId: decision.processInstanceId,
        }),
      );

      await text(
        'send-info-reply',
        formatSmsDecisionInfo({
          name: decision.name,
          phaseName: decision.currentPhase?.name ?? null,
          votingOpen: decision.currentPhase
            ? isVotingPhase(decision.currentPhase)
            : false,
          proposalCount,
        }),
      );
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
