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
    // A revert inside this window retires the result row, so an admin who
    // publishes, backs out and republishes announces only what stands.
    debounce: {
      key: 'event.data.processInstanceId',
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
        processResultId,
        reason: result.reason,
      });

      return;
    }

    const { processTitle, processProfileSlug, messages, recipients } =
      result.notification;
    const appUrl = OPURLConfig('APP').ENV_URL;

    const sendResult = await step.run('send-emails', async () =>
      sendNotificationEmails({
        emails: recipients.map(
          ({ email, proposalProfileId, outcome, values }) => {
            const isSelected = outcome === 'selected';

            return {
              to: email,
              subject: DecisionResultEmail.subject(processTitle, isSelected),
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
                }),
            };
          },
        ),
        failureMessage: 'decision result notifications',
        context: { processInstanceId, processResultId },
        idempotencyKeyPrefix: `decision-results/${runId}`,
      }),
    );

    return {
      message: `${sendResult.sent} decision result notification(s) sent`,
    };
  },
);
