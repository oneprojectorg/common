import {
  type DecisionInstanceData,
  RateLimitError,
  UnauthorizedError,
  assertVoteAccess,
  findSingleChoiceBallotProposal,
  getPhoneSignupState,
  getSmsProvider,
  safeParsePhoneNumber,
} from '@op/common';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const HELP_MESSAGE =
  'Text VOTE followed by the decision name, for example VOTE columbus.';
const { smsInboundReceived, voteSmsPromptRequested } = Events;

export const handleSmsVoteCommand = inngest.createFunction(
  {
    id: 'handleSmsVoteCommand',
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

    const decision = await step.run('find-decision', async () => {
      const profile = await db.query.profiles.findFirst({
        where: { slug: argument, type: EntityType.DECISION },
        columns: { id: true, name: true },
        with: {
          processInstance: {
            columns: { id: true, instanceData: true, currentStateId: true },
          },
        },
      });

      if (!profile?.processInstance) {
        return null;
      }

      const instanceData = profile.processInstance
        .instanceData as DecisionInstanceData;
      const currentPhase = instanceData?.phases?.find(
        (phase) => phase.phaseId === profile.processInstance?.currentStateId,
      );

      const ballotProposal = await findSingleChoiceBallotProposal({
        processInstanceId: profile.processInstance.id,
        phase: currentPhase,
      });

      return {
        profileId: profile.id,
        name: profile.name,
        processInstanceId: profile.processInstance.id,
        ballotProposalId: ballotProposal?.id ?? null,
      };
    });

    if (!decision) {
      await text(
        'send-not-found-reply',
        'Not found reply',
        `No decision named "${argument}" was found.`,
      );
      return { message: 'decision not found' };
    }

    const ballotProposalId = decision.ballotProposalId;

    if (!ballotProposalId) {
      await text(
        'send-unavailable-reply',
        'Unavailable reply',
        `Voting for "${decision.name}" is not open by text.`,
      );
      return { message: 'ballot unavailable by sms' };
    }

    const canVote = await step.run('check-vote-access', async () => {
      try {
        await assertVoteAccess({
          authUserId: account.authUserId,
          profileId: decision.profileId,
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
        'send-not-participant-reply',
        'Not participant reply',
        `You are not a participant in "${decision.name}".`,
      );
      return { message: 'not a participant' };
    }

    await step.run('request-vote-prompt', () =>
      inngest.send({
        name: voteSmsPromptRequested.name,
        data: {
          processInstanceId: decision.processInstanceId,
          proposalId: ballotProposalId,
          authUserId: account.authUserId,
          phone: to,
        },
      }),
    );

    logger.info('Requested an SMS vote prompt from a VOTE command', {
      processInstanceId: decision.processInstanceId,
      proposalId: ballotProposalId,
      authUserId: account.authUserId,
    });

    return { message: 'vote prompt requested' };
  },
);
