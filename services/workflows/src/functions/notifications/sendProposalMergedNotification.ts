import { listProposalMergeRecipients } from '@op/common';
import { OPURLConfig } from '@op/core';
import { ProposalMergedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { sendNotificationEmails } from './sendNotificationEmails';

const { proposalMerged } = Events;

export const sendProposalMergedNotification = inngest.createFunction(
  {
    id: 'sendProposalMergedNotification',
    debounce: {
      key: 'event.data.relationshipId',
      period: '1m',
      timeout: '3m',
    },
    // A decision admin merging a batch of proposals fires one run each, and a
    // collaborative proposal can carry a long author list. Capping runs keeps a
    // bulk cleanup from opening every send at once against the email provider.
    concurrency: { limit: 5 },
  },
  { event: proposalMerged.name },
  async ({ event, step }) => {
    const { relationshipId, actorAuthUserId } = proposalMerged.schema.parse(
      event.data,
    );

    const result = await step.run('get-recipients', async () =>
      listProposalMergeRecipients({ relationshipId, actorAuthUserId }),
    );

    if (!result.ok) {
      logger.info('No proposal merged notification to send', {
        relationshipId,
        reason: result.reason,
      });

      return;
    }

    const {
      sourceProposalName,
      sourceProposalProfileId,
      targetProposalName,
      targetProposalProfileId,
      processTitle,
      processProfileSlug,
      recipients,
    } = result.notification;

    const proposalBaseUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfileSlug}/proposal`;
    const proposalUrl = `${proposalBaseUrl}/${sourceProposalProfileId}`;
    const targetProposalUrl = `${proposalBaseUrl}/${targetProposalProfileId}`;

    const sendResult = await step.run('send-emails', async () =>
      sendNotificationEmails({
        emails: recipients.map(({ email }) => ({
          to: email,
          subject: ProposalMergedEmail.subject(sourceProposalName),
          component: () =>
            ProposalMergedEmail({
              proposalName: sourceProposalName,
              targetProposalName,
              processTitle,
              proposalUrl,
              targetProposalUrl,
            }),
        })),
        failureMessage: 'proposal merged notifications',
        context: { relationshipId },
      }),
    );

    return {
      message: `${sendResult.sent} proposal merged notification(s) sent`,
    };
  },
);
