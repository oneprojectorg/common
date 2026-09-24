import {
  type EligibleProposal,
  getSmsProvider,
  listEligibleProposals,
  parsePhoneNumber,
  submitVote,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const CONFIRMATION_KEYWORD = 'YES';
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
    const { processInstanceId, authUserId, phone } =
      voteSmsPromptRequested.schema.parse(event.data);

    const eligibleProposals = await step.run(
      'get-eligible-proposals',
      async () => listEligibleProposals({ processInstanceId }),
    );

    if (eligibleProposals.length === 0) {
      logger.error('No eligible proposals found for SMS vote request', {
        processInstanceId,
      });
      return { message: 'no eligible proposals' };
    }

    const provider = getSmsProvider();

    if (!provider?.sendSms) {
      logger.error(
        'Cannot request an SMS vote: no Twilio Messaging Service configured',
        { processInstanceId },
      );
      return { message: 'sms sending unavailable' };
    }

    const to = parsePhoneNumber(phone);
    const promptBody = buildVotePromptBody(eligibleProposals);

    await step.run('send-vote-prompt', async () => {
      const result = await provider.sendSms!({ to, body: promptBody });
      if (result.status === 'rejected') {
        logger.warn('Vote prompt send rejected', {
          authUserId,
          reason: result.reason,
        });
      }
    });

    const reply = await step.waitForEvent('wait-for-vote-reply', {
      event: smsInboundReceived.name,
      if: 'event.data.phone == async.data.from',
      timeout: '72h',
    });

    if (!reply) {
      logger.info('No vote reply received in time', {
        processInstanceId,
        authUserId,
      });
      return { message: 'timed out waiting for vote reply' };
    }

    const { body: replyBody } = smsInboundReceived.schema.parse(reply.data);
    const selectedProposal = resolveSelectedProposal(
      replyBody,
      eligibleProposals,
    );

    if (!selectedProposal) {
      logger.info('Reply did not select an eligible proposal', {
        processInstanceId,
        authUserId,
      });
      return { message: 'reply did not confirm' };
    }

    const result = await step.run('submit-vote', () =>
      submitVote({
        data: {
          processInstanceId,
          selectedProposalIds: [selectedProposal.id],
          authUserId,
        },
        authUserId,
      }),
    );

    logger.info('Recorded a vote from an SMS reply', {
      processInstanceId,
      proposalId: selectedProposal.id,
      authUserId,
    });

    return { message: 'vote recorded', voteSubmissionId: result.id };
  },
);

/**
 * A lone proposal keeps the plain "Reply YES" prompt; more than one gets a
 * 1-based numbered list, since a keyword can't distinguish between choices.
 */
function buildVotePromptBody(eligibleProposals: EligibleProposal[]): string {
  if (eligibleProposals.length === 1) {
    return `Reply ${CONFIRMATION_KEYWORD} to vote for "${eligibleProposals[0]!.title}".`;
  }

  return [
    'Reply with a number to vote:',
    ...eligibleProposals.map(
      (proposal, index) => `${index + 1}. ${proposal.title}`,
    ),
  ].join('\n');
}

/**
 * Mirrors {@link buildVotePromptBody}: a lone proposal is confirmed by the
 * fixed keyword, and more than one is chosen by the 1-based number it was
 * listed under. Anything else -- a stray keyword, a decimal, an out-of-range
 * or non-numeric reply -- doesn't select a proposal.
 */
function resolveSelectedProposal(
  replyBody: string,
  eligibleProposals: EligibleProposal[],
): EligibleProposal | undefined {
  const trimmed = replyBody.trim();

  if (eligibleProposals.length === 1) {
    return trimmed.toUpperCase() === CONFIRMATION_KEYWORD
      ? eligibleProposals[0]
      : undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  return eligibleProposals[Number(trimmed) - 1];
}
