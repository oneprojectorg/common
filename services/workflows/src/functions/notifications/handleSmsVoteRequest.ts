import {
  RateLimitError,
  getSmsProvider,
  parsePhoneNumber,
  submitVote,
} from '@op/common';
import { db } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const CONFIRMATION_KEYWORD = 'YES';
const MAX_REPLY_ATTEMPTS = 3;
const REPLY_ATTEMPT_TIMEOUT = '24h';
const { voteSmsPromptRequested, smsInboundReceived } = Events;

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

    const to = parsePhoneNumber(phone);

    const promptResult = await step.run('send-vote-prompt', async () => {
      const result = await provider.sendSms!({
        to,
        body: `Reply ${CONFIRMATION_KEYWORD} to vote for "${proposalTitle}".`,
      });
      if (result.status === 'rejected' && result.retryable) {
        throw new RateLimitError(
          `Vote prompt send rejected: ${result.reason}`,
        );
      }
      return result;
    });

    if (promptResult.status === 'rejected') {
      logger.warn('Vote prompt permanently rejected, aborting vote request', {
        processInstanceId,
        proposalId,
        authUserId,
        reason: promptResult.reason,
      });
      return { message: 'vote prompt send rejected', reason: promptResult.reason };
    }

    let confirmed = false;

    for (let attempt = 1; attempt <= MAX_REPLY_ATTEMPTS; attempt++) {
      const reply = await step.waitForEvent(`wait-for-vote-reply-${attempt}`, {
        event: smsInboundReceived.name,
        if: 'event.data.phone == async.data.from',
        timeout: REPLY_ATTEMPT_TIMEOUT,
      });

      if (!reply) {
        logger.info('No vote reply received in time', {
          processInstanceId,
          proposalId,
          authUserId,
          attempt,
        });
        return { message: 'timed out waiting for vote reply' };
      }

      const { body: replyBody } = smsInboundReceived.schema.parse(reply.data);

      if (replyBody.trim().toUpperCase() === CONFIRMATION_KEYWORD) {
        confirmed = true;
        break;
      }

      logger.info(
        'Reply did not match the vote confirmation keyword, waiting for another reply',
        { processInstanceId, proposalId, authUserId, attempt },
      );
    }

    if (!confirmed) {
      return { message: 'reply did not confirm' };
    }

    const result = await step.run('submit-vote', () =>
      submitVote({
        data: {
          processInstanceId,
          selectedProposalIds: [proposalId],
          authUserId,
        },
        authUserId,
      }),
    );

    logger.info('Recorded a vote from an SMS reply', {
      processInstanceId,
      proposalId,
      authUserId,
    });

    return { message: 'vote recorded', voteSubmissionId: result.id };
  },
);
