import { NotFoundError, getCategoryDevelopmentRecipients } from '@op/common';
import { OPURLConfig } from '@op/core';
import { CategoryDevelopmentConfirmedAdminEmail } from '@op/emails';
import { Events, inngest } from '@op/events';

import { sendNotificationEmails } from './sendNotificationEmails';

const { categoryDevelopmentConfirmed } = Events;

export const sendCategoryDevelopmentConfirmedNotification =
  inngest.createFunction(
    {
      id: 'sendCategoryDevelopmentConfirmedNotification',
      // Two reviewers who confirm at the same time, or a confirm, unconfirm
      // and confirm, give one send.
      debounce: {
        key: 'event.data.processInstanceId + "-" + event.data.taxonomyTermId',
        period: '1m',
        timeout: '3m',
      },
    },
    { event: categoryDevelopmentConfirmed.name },
    async ({ event, step, runId }) => {
      const { processInstanceId, phaseId, taxonomyTermId } =
        categoryDevelopmentConfirmed.schema.parse(event.data);

      const recipientsResult = await step.run('get-recipients', async () => {
        try {
          return {
            ok: true as const,
            recipients: await getCategoryDevelopmentRecipients({
              processInstanceId,
              phaseId,
              taxonomyTermId,
            }),
          };
        } catch (error) {
          if (error instanceof NotFoundError) {
            return { ok: false as const };
          }
          throw error;
        }
      });

      if (!recipientsResult.ok) {
        return { skipped: 'process instance or category not found' };
      }

      const {
        isComplete,
        categoryName,
        processName,
        decisionSlug,
        advancingCount,
        adminEmails,
      } = recipientsResult.recipients;

      if (!isComplete) {
        return { skipped: 'category not confirmed by every reviewer' };
      }

      const processUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${decisionSlug}`;
      const emailProps = {
        categoryName,
        processName,
        advancingCount,
        processUrl,
      };
      const context = { processInstanceId, taxonomyTermId };

      if (adminEmails.length > 0) {
        await step.run('send-admin-emails', async () =>
          sendNotificationEmails({
            emails: adminEmails.map((email) => ({
              to: email,
              subject: CategoryDevelopmentConfirmedAdminEmail.subject(
                categoryName,
                processName,
              ),
              component: () =>
                CategoryDevelopmentConfirmedAdminEmail(emailProps),
            })),
            failureMessage: 'category development confirmed admin emails',
            context,
            idempotencyKeyPrefix: `category-development-confirmed/${runId}/admins`,
          }),
        );
      }

      return {
        adminCount: adminEmails.length,
      };
    },
  );
