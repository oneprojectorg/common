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
    // A revert inside this window retires the result row, and the recipient
    // helper then declines to send at all — so an admin who publishes, backs
    // out, and republishes announces only the outcome that stands.
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
      // Only a retired result is a normal outcome — the admin reverted inside
      // the debounce window. Everything else means an audience that should
      // have heard will not, on a publish that cannot be re-triggered, so it
      // has to be loud enough to find.
      const log = result.reason === 'resultRetired' ? logger.info : logger.warn;
      log('No decision result notifications to send', {
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
            const isFunded = outcome === 'funded';

            return {
              to: email,
              subject: DecisionResultEmail.subject(processTitle, isFunded),
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
                  isFunded,
                }),
            };
          },
        ),
        failureMessage: 'decision result notifications',
        context: { processInstanceId, processResultId },
        // Stable across retries, unique per run: a retry replays delivered
        // chunks and only the failed ones go out again.
        idempotencyKeyPrefix: `decision-results/${runId}`,
      }),
    );

    return {
      message: `${sendResult.sent} decision result notification(s) sent`,
    };
  },
);
