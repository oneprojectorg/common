import { getSmsProvider, parsePhoneNumber, submitVote } from '@op/common';
import { db } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const CONFIRMATION_KEYWORD = 'YES';
const { voteSmsPromptRequested, smsInboundReceived } = Events;

export const handleSmsVoteRequest = inngest.createFunction(
  {
    id: 'handleSmsVoteRequest',
    debounce: {
      key: 'event.data.phone + "-" + event.data.processInstanceId',
      period: '1m',
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

    await step.run('send-vote-prompt', async () => {
      const result = await provider.sendSms!({
        to,
        body: `Reply ${CONFIRMATION_KEYWORD} to vote for "${proposalTitle}".`,
      });
      if (result.status === 'rejected') {
        logger.warn('Vote prompt send rejected', {
          phone,
          reason: result.reason,
        });
      }
    });

    const reply = await step.waitForEvent('wait-for-vote-reply', {
      event: smsInboundReceived.name,
      match: 'data.from',
      timeout: '72h',
    });

    if (!reply) {
      logger.info('No vote reply received in time', {
        processInstanceId,
        proposalId,
        phone,
      });
      return { message: 'timed out waiting for vote reply' };
    }

    const { body: replyBody } = smsInboundReceived.schema.parse(reply.data);

    if (replyBody.trim().toUpperCase() !== CONFIRMATION_KEYWORD) {
      logger.info('Reply did not match the vote confirmation keyword', {
        processInstanceId,
        proposalId,
        phone,
      });
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
