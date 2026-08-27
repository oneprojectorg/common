import { listProposalRejectionRecipients } from '@op/common';
import { OPURLConfig } from '@op/core';
import { ProposalRejectedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { sendNotificationEmails } from './sendNotificationEmails';

const { proposalRejected } = Events;

export const sendProposalRejectedNotification = inngest.createFunction(
  {
    id: 'sendProposalRejectedNotification',
    // The success toast puts Undo one tap away, so a reject/undo/reject flurry
    // has to collapse into one send — of whichever rejection ends up standing.
    debounce: {
      key: 'event.data.proposalId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: proposalRejected.name },
  async ({ event, step }) => {
    const { proposalId, reason, note, actorAuthUserId } =
      proposalRejected.schema.parse(event.data);

    const result = await step.run('get-recipients', async () =>
      listProposalRejectionRecipients({ proposalId, actorAuthUserId }),
    );

    if (!result.ok) {
      logger.info('No proposal rejected notification to send', {
        proposalId,
        reason: result.reason,
      });

      return;
    }

    const {
      proposalName,
      proposalProfileId,
      processTitle,
      processProfileSlug,
      recipients,
    } = result.notification;

    const proposalUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfileSlug}/proposal/${proposalProfileId}`;

    const sendResult = await step.run('send-emails', async () =>
      sendNotificationEmails({
        emails: recipients.map(({ email }) => ({
          to: email,
          subject: ProposalRejectedEmail.subject(proposalName),
          component: () =>
            ProposalRejectedEmail({
              proposalName,
              processTitle,
              proposalUrl,
              reason,
              note,
            }),
        })),
        failureMessage: 'proposal rejected notifications',
        context: { proposalId },
      }),
    );

    return {
      message: `${sendResult.sent} proposal rejected notification(s) sent`,
    };
  },
);
