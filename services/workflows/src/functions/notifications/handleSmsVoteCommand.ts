import {
  RateLimitError,
  UnauthorizedError,
  assertProfileAccess,
  decisionPermission,
  findSmsDecision,
  getSmsVotability,
  getPhoneSignupState,
  getSmsProvider,
  safeParsePhoneNumber,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { permission } from 'access-zones';

import { smsNumberRateLimit } from './smsInboundLimits';

const HELP_MESSAGE =
  'Text VOTE followed by the decision name, for example VOTE columbus. Text DECISIONS to see yours.';
const { smsInboundReceived, voteSmsBallotRequested } = Events;

export const handleSmsVoteCommand = inngest.createFunction(
  {
    id: 'handleSmsVoteCommand',
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
  { event: smsInboundReceived.name, if: 'event.data.keyword == "vote"' },
  async ({ event, step }) => {
    const { from, argument } = smsInboundReceived.schema.parse(event.data);

    const parsedFrom = safeParsePhoneNumber(from);

    if (!parsedFrom.success) {
      logger.info('VOTE command from a non-E.164 number, skipping', {
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
      logger.info('VOTE command from a number with no account, skipping');
      return { message: 'unknown number, skipped' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot answer a VOTE command: no Twilio Messaging Service configured',
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;

    const text = (stepId: string, label: string, body: string) =>
      step.run(stepId, async () => {
        const result = await sendSms({ to, body });
        if (result.status === 'rejected' && result.retryable) {
          throw new RateLimitError(`${label} send rejected: ${result.reason}`);
        }
        return result;
      });

    if (!argument) {
      await text('send-help-reply', 'Help reply', HELP_MESSAGE);
      return { message: 'help sent' };
    }

    const decision = await step.run('find-decision', () =>
      findSmsDecision({ authUserId: account.authUserId, slug: argument }),
    );

    if (!decision) {
      await text(
        'send-not-found-reply',
        'Not found reply',
        `No decision named "${argument}" was found.`,
      );
      return { message: 'decision not found' };
    }

    const canVote = await step.run('check-vote-access', async () => {
      try {
        await assertProfileAccess({
          user: { id: account.authUserId },
          profileId: decision.profileId,
          permissions: [
            { decisions: permission.ADMIN },
            { decisions: decisionPermission.VOTE },
          ],
        });
        return true;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return false;
        }
        throw error;
      }
    });

    if (!canVote) {
      await text(
        'send-cannot-vote-reply',
        'Cannot vote reply',
        `You cannot vote in "${decision.name}".`,
      );
      return { message: 'not allowed to vote' };
    }

    const votability = await step.run('get-sms-votability', () =>
      getSmsVotability({
        processInstanceId: decision.processInstanceId,
        phase: decision.currentPhase ?? undefined,
      }),
    );

    if (!votability.votingOpen || votability.eligibleProposalCount === 0) {
      logger.info('VOTE command refused: no ballot by text', {
        processInstanceId: decision.processInstanceId,
        votingOpen: votability.votingOpen,
        eligibleProposalCount: votability.eligibleProposalCount,
      });
      await text(
        'send-unavailable-reply',
        'Unavailable reply',
        votability.votingOpen
          ? `"${decision.name}" has no proposals to vote on.`
          : `Voting for "${decision.name}" is not open.`,
      );
      return {
        message: 'no ballot by sms',
        votingOpen: votability.votingOpen,
        eligibleProposalCount: votability.eligibleProposalCount,
      };
    }

    await step.run('request-ballot', () =>
      inngest.send({
        name: voteSmsBallotRequested.name,
        data: {
          processInstanceId: decision.processInstanceId,
          authUserId: account.authUserId,
          phone: to,
        },
      }),
    );

    logger.info('Requested an SMS ballot from a VOTE command', {
      processInstanceId: decision.processInstanceId,
      authUserId: account.authUserId,
    });

    return { message: 'ballot requested' };
  },
);
