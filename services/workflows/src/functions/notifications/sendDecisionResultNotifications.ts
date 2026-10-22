import {
  listResultNotificationRecipients,
  renderResultNotificationMessage,
  selectResultNotificationTemplate,
} from '@op/common';
import { OPURLConfig } from '@op/core';
import { DecisionResultEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

import { sendNotificationEmails } from './sendNotificationEmails';

const { decisionResultsNotified } = Events;

export const sendDecisionResultNotifications = inngest.createFunction(
  {
    id: 'sendDecisionResultNotifications',
    // Per phase, so a later advance doesn't drop an earlier phase's send.
    debounce: {
      key: 'event.data.processInstanceId + "-" + event.data.previousPhaseId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: decisionResultsNotified.name },
  async ({ event, step, runId }) => {
    const {
      processInstanceId,
      processResultId,
      transitionHistoryId,
      previousPhaseId,
    } = decisionResultsNotified.schema.parse(event.data);

    const result = await step.run('get-recipients', async () =>
      listResultNotificationRecipients({
        processInstanceId,
        processResultId,
        transitionHistoryId,
        previousPhaseId,
      }),
    );

    if (!result.ok) {
      logger.info('No decision result notifications to send', {
        processInstanceId,
        transitionHistoryId,
        reason: result.reason,
      });

      return;
    }

    const {
      processTitle,
      processProfileSlug,
      publishesResults,
      messages,
      recipients,
    } = result.notification;
    const appUrl = OPURLConfig('APP').ENV_URL;

    const sendResult = await step.run('send-emails', async () =>
      sendNotificationEmails({
        emails: recipients.map(
          ({ email, proposalProfileId, outcome, values }) => {
            const isSelected = outcome === 'selected';

            return {
              to: email,
              subject: DecisionResultEmail.subject({
                processTitle,
                isSelected,
                publishesResults,
              }),
              component: () =>
                DecisionResultEmail({
                  processTitle,
                  message: renderResultNotificationMessage({
                    template: selectResultNotificationTemplate({
                      messages,
                      outcome,
                    }),
                    values,
                  }),
                  proposalUrl: `${appUrl}/decisions/${processProfileSlug}/proposal/${proposalProfileId}`,
                  isSelected,
                  publishesResults,
                }),
            };
          },
        ),
        failureMessage: 'decision result notifications',
        context: { processInstanceId, transitionHistoryId },
        idempotencyKeyPrefix: `decision-results/${runId}`,
      }),
    );

    return {
      message: `${sendResult.sent} decision result notification(s) sent`,
    };
  },
);
