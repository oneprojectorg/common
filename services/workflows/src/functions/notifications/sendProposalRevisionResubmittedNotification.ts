import { listProfileRecipients } from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { ProposalReviewRequestState } from '@op/db/schema';
import { OPBatchSend, RevisionResubmittedEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const key = 'event.data.proposalId + "-" + event.data.proposalHistoryId';
const { reviewProposalRevisionSubmitted } = Events;

export const sendProposalRevisionResubmittedNotification =
  inngest.createFunction(
    {
      id: 'sendProposalRevisionResubmittedNotification',
      debounce: {
        key,
        period: '1m',
        timeout: '3m',
      },
    },
    { event: reviewProposalRevisionSubmitted.name },
    async ({ event, step, runId }) => {
      const { proposalId, proposalHistoryId, revisionRequestIds } =
        reviewProposalRevisionSubmitted.schema.parse(event.data);

      // Reading and planning share one step so the reviewer profile types stay
      // typed; a step boundary would widen them to plain JSON strings.
      const plan = await step.run('plan-requester-emails', async () => {
        const requests = await db.query.proposalReviewRequests.findMany({
          where: { id: { in: revisionRequestIds } },
          columns: { id: true, state: true },
          with: {
            assignment: {
              columns: {
                id: true,
                proposalId: true,
                reviewerProfileId: true,
              },
              with: {
                reviewer: { columns: { id: true, type: true } },
                proposal: {
                  columns: {},
                  with: { profile: { columns: { name: true } } },
                },
                processInstance: {
                  columns: {},
                  with: { profile: { columns: { name: true, slug: true } } },
                },
              },
            },
          },
        });

        const answered = requests.filter(
          (request) =>
            request.state === ProposalReviewRequestState.RESUBMITTED &&
            request.assignment.proposalId === proposalId,
        );

        if (answered.length === 0) {
          logger.warn('No resubmitted revision requests to notify about', {
            proposalId,
            proposalHistoryId,
          });
          return null;
        }

        // Every request the event carries answers the same resubmission, so
        // the proposal and process names are the same on all of them.
        const first = answered[0];
        const processProfile = first?.assignment.processInstance.profile;
        const proposalName = first?.assignment.proposal.profile?.name;

        if (!processProfile || !proposalName) {
          logger.error('Missing proposal or process profile for resubmission', {
            proposalId,
            proposalHistoryId,
          });
          return null;
        }

        const reviewsUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processProfile.slug}/reviews`;

        const emails: Array<{ to: string; proposalUrl: string }> = [];
        const assignmentIdsWithoutAddress: Array<string> = [];
        const seenReviewerProfileIds = new Set<string>();

        // One resubmission answers several requests, so the fan-out is per
        // requester: a reviewer holding two answered requests gets one email,
        // linked to their own assignment rather than a shared page.
        for (const { assignment } of answered) {
          if (seenReviewerProfileIds.has(assignment.reviewerProfileId)) {
            continue;
          }
          seenReviewerProfileIds.add(assignment.reviewerProfileId);

          const recipients = selectEmailRecipients(
            await listProfileRecipients(assignment.reviewer),
          );

          if (recipients.length === 0) {
            assignmentIdsWithoutAddress.push(assignment.id);
            continue;
          }

          for (const to of recipients) {
            emails.push({
              to,
              proposalUrl: `${reviewsUrl}/${assignment.id}`,
            });
          }
        }

        if (assignmentIdsWithoutAddress.length > 0) {
          logger.warn('Skipped requesters with no delivery address', {
            proposalId,
            assignmentIds: assignmentIdsWithoutAddress,
          });
        }

        return {
          proposalName,
          processTitle: processProfile.name,
          emails,
        };
      });

      if (!plan || plan.emails.length === 0) {
        return { message: '0 revision resubmitted notification(s) sent' };
      }

      const { proposalName, processTitle, emails } = plan;

      const result = await step.run('send-emails', async () => {
        const { data, errors } = await OPBatchSend(
          emails.map(({ to, proposalUrl }) => ({
            to,
            subject: RevisionResubmittedEmail.subject(proposalName),
            component: () =>
              RevisionResubmittedEmail({
                proposalName,
                processTitle,
                proposalUrl,
              }),
          })),
          {
            // Stable across retries, unique per run: a retry replays delivered
            // chunks and only the failed ones go out again.
            idempotencyKeyPrefix: `proposal-revision-resubmitted/${runId}`,
          },
        );

        if (errors.length > 0) {
          logger.error(
            'Some revision resubmitted notifications failed to send',
            { proposalId, failedCount: errors.length },
          );
          throw new Error(
            `Revision resubmitted email batch failed for ${errors.length} recipient(s)`,
          );
        }

        return { sent: data.length };
      });

      return {
        message: `${result.sent} revision resubmitted notification(s) sent`,
      };
    },
  );
