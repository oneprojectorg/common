import {
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  getSmsProvider,
  parsePhoneNumber,
  submitVote,
} from '@op/common';
import { db } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const MAX_REPLY_ATTEMPTS = 3;
const REPLY_WINDOW_MS = 24 * 60 * 60_000;
const { voteSmsPromptRequested, smsInboundReceived } = Events;

type ReplyOutcome = 'confirmed' | 'timed_out' | 'exhausted';

export const handleSmsVoteRequest = inngest.createFunction(
  {
    id: 'handleSmsVoteRequest',
    debounce: {
      key: 'event.data.phone + "-" + event.data.processInstanceId',
      period: '1m',
    },
    singleton: {
      key: 'event.data.phone',
      mode: 'skip',
    },
  },
  { event: voteSmsPromptRequested.name },
  async ({ event, step }) => {
    const { processInstanceId, proposalId, authUserId, phone } =
      voteSmsPromptRequested.schema.parse(event.data);

    const proposalTitle = await step.run('get-proposal-title', async () => {
      const [row] = await db
        .select({ title: profiles.name })
        .from(proposals)
        .innerJoin(profiles, eq(profiles.id, proposals.profileId))
        .where(eq(proposals.id, proposalId))
        .limit(1);
      return row?.title ?? null;
    });

    if (!proposalTitle) {
      logger.error('No proposal found for SMS vote request', {
        processInstanceId,
        proposalId,
      });
      return { message: 'proposal not found' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot request an SMS vote: no Twilio Messaging Service configured',
        { processInstanceId, proposalId },
      );
      return { message: 'sms sending unavailable' };
    }

    const sendSms = provider.sendSms;
    const to = parsePhoneNumber(phone);

    const text = (stepId: string, label: string, body: string) =>
      step.run(stepId, async () => {
        const result = await sendSms({ to, body });
        if (result.status === 'rejected' && result.retryable) {
          throw new RateLimitError(`${label} send rejected: ${result.reason}`);
        }
        return result;
      });

    const promptResult = await text(
      'send-vote-prompt',
      'Vote prompt',
      `Reply YES to vote for "${proposalTitle}".`,
    );

    if (promptResult.status === 'rejected') {
      logger.warn('Vote prompt permanently rejected, aborting vote request', {
        processInstanceId,
        proposalId,
        authUserId,
        reason: promptResult.reason,
      });
      return {
        message: 'vote prompt send rejected',
        reason: promptResult.reason,
      };
    }

    const replyDeadline = await step.run(
      'start-reply-window',
      () => Date.now() + REPLY_WINDOW_MS,
    );

    const awaitConfirmation = async (
      attempt: number,
    ): Promise<ReplyOutcome> => {
      if (attempt > MAX_REPLY_ATTEMPTS) {
        return 'exhausted';
      }

      const reply = await step.waitForEvent(`wait-for-vote-reply-${attempt}`, {
        event: smsInboundReceived.name,
        if: 'event.data.phone == async.data.from',
        timeout: new Date(replyDeadline),
      });

      if (!reply) {
        return 'timed_out';
      }

      const { keyword } = smsInboundReceived.schema.parse(reply.data);

      if (keyword === 'yes') {
        return 'confirmed';
      }

      logger.info('Reply did not confirm the vote, waiting for another reply', {
        processInstanceId,
        proposalId,
        authUserId,
        attempt,
      });
      return awaitConfirmation(attempt + 1);
    };

    const outcome = await awaitConfirmation(1);

    if (outcome === 'timed_out') {
      logger.info('No vote reply received in time', {
        processInstanceId,
        proposalId,
        authUserId,
      });
      return { message: 'timed out waiting for vote reply' };
    }

    if (outcome === 'exhausted') {
      logger.info('No confirming reply in the allowed replies', {
        processInstanceId,
        proposalId,
        authUserId,
        attempts: MAX_REPLY_ATTEMPTS,
      });
      return { message: 'reply did not confirm', attempts: MAX_REPLY_ATTEMPTS };
    }

    const vote = await step.run('submit-vote', async () => {
      try {
        const submission = await submitVote({
          data: {
            processInstanceId,
            selectedProposalIds: [proposalId],
            authUserId,
          },
          authUserId,
        });
        return { status: 'recorded' as const, voteSubmissionId: submission.id };
      } catch (error) {
        if (
          error instanceof ValidationError ||
          error instanceof UnauthorizedError
        ) {
          return { status: 'rejected' as const, reason: error.message };
        }
        throw error;
      }
    });

    if (vote.status === 'rejected') {
      logger.warn('SMS vote was not recorded', {
        processInstanceId,
        proposalId,
        authUserId,
        reason: vote.reason,
      });
      return { message: 'vote rejected', reason: vote.reason };
    }

    const receiptResult = await text(
      'send-vote-receipt',
      'Vote receipt',
      `Your vote for "${proposalTitle}" is recorded.`,
    );

    if (receiptResult.status === 'rejected') {
      logger.warn('Vote receipt permanently rejected', {
        processInstanceId,
        proposalId,
        authUserId,
        reason: receiptResult.reason,
      });
    }

    logger.info('Recorded a vote from an SMS reply', {
      processInstanceId,
      proposalId,
      authUserId,
    });

    return {
      message: 'vote recorded',
      voteSubmissionId: vote.voteSubmissionId,
    };
  },
);
