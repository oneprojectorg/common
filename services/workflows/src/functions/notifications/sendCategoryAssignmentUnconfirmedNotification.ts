import { NotFoundError, getCategoryAssignmentReceipt } from '@op/common';
import { OPURLConfig } from '@op/core';
import { CategoryAssignmentUnconfirmedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';

import { sendNotificationEmails } from './sendNotificationEmails';

const { categoryDevelopmentUnconfirmed } = Events;

export const sendCategoryAssignmentUnconfirmedNotification =
  inngest.createFunction(
    { id: 'sendCategoryAssignmentUnconfirmedNotification' },
    { event: categoryDevelopmentUnconfirmed.name },
    async ({ event, step, runId }) => {
      const assignment = categoryDevelopmentUnconfirmed.schema.parse(
        event.data,
      );

      const receiptResult = await step.run('get-receipt', async () => {
        try {
          return {
            ok: true as const,
            receipt: await getCategoryAssignmentReceipt(assignment),
          };
        } catch (error) {
          if (error instanceof NotFoundError) {
            return { ok: false as const };
          }
          throw error;
        }
      });

      if (!receiptResult.ok) {
        return {
          skipped: 'process instance, category or assignment not found',
        };
      }

      const { isConfirmed, categoryName, processName, decisionSlug, emails } =
        receiptResult.receipt;

      if (isConfirmed) {
        return { skipped: 'assignment confirmed again' };
      }

      if (emails.length === 0) {
        return { skipped: 'no email address for the assigned person' };
      }

      const processUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${decisionSlug}`;

      await step.run('send-receipt', async () =>
        sendNotificationEmails({
          emails: emails.map((email) => ({
            to: email,
            subject: CategoryAssignmentUnconfirmedEmail.subject(categoryName),
            component: () =>
              CategoryAssignmentUnconfirmedEmail({
                categoryName,
                processName,
                processUrl,
              }),
          })),
          failureMessage: 'category assignment unconfirmed receipt',
          context: {
            processInstanceId: assignment.processInstanceId,
            taxonomyTermId: assignment.taxonomyTermId,
            reviewerProfileId: assignment.reviewerProfileId,
          },
          idempotencyKeyPrefix: `category-assignment-unconfirmed/${runId}`,
        }),
      );

      return { sent: emails.length };
    },
  );
