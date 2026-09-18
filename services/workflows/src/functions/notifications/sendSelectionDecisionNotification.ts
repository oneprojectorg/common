import { resolveManualSelectionStatus } from '@op/common';
import { hasEmail } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import {
  ProposalStatus,
  decisionProcessResultSelections,
  processInstances,
  profileUsers,
  profiles,
  proposals,
} from '@op/db/schema';
import { OPBatchSend, SelectionDecisionEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const { resultsProcessed } = Events;

/**
 * Emails each proposal's authors their selection outcome after results are
 * processed for a decision process. Selected = proposals attached to the
 * result row; everyone else with a submitted (non-draft) proposal gets the
 * not-selected variant.
 */
export const sendSelectionDecisionNotification = inngest.createFunction(
  {
    id: 'sendSelectionDecisionNotification',
    debounce: {
      key: 'event.data.processInstanceId + "-" + event.data.processResultId',
      period: '1m',
      timeout: '3m',
    },
  },
  { event: resultsProcessed.name },
  async ({ event, step }) => {
    const { processInstanceId, processResultId } =
      resultsProcessed.schema.parse(event.data);

    const processData = await step.run('get-process-data', async () => {
      const instance = await db
        .select({
          name: processInstances.name,
          instanceData: processInstances.instanceData,
          currentStateId: processInstances.currentStateId,
          profileSlug: profiles.slug,
        })
        .from(processInstances)
        .leftJoin(profiles, eq(processInstances.profileId, profiles.id))
        .where(eq(processInstances.id, processInstanceId))
        .limit(1);

      return instance[0];
    });

    if (!processData) {
      logger.error('No process instance found for id', { processInstanceId });
      return;
    }

    // Hold the email until the inbound transition is settled — when results
    // were processed on a phase advance that still awaits a manual selection,
    // authors would otherwise be told an outcome the admin hasn't confirmed.
    // submitManualSelection re-processes results (a new result row + event)
    // when the admin confirms.
    const manualSelectionStatus = await step.run(
      'check-manual-selection',
      async () =>
        resolveManualSelectionStatus({
          instance: {
            id: processInstanceId,
            instanceData: processData.instanceData,
            currentStateId: processData.currentStateId,
          },
        }),
    );

    if (!manualSelectionStatus.selectionsAreConfirmed) {
      return {
        message: `Skipped: selections not yet confirmed for instance ${processInstanceId}`,
      };
    }

    // Only ever report the latest run: if results were re-processed after
    // this event fired, the newer event covers the newer row.
    const latestResult = await step.run('check-latest-result', async () =>
      db.query.decisionProcessResults.findFirst({
        where: { processInstanceId },
        orderBy: (table, { desc }) => desc(table.executedAt),
        columns: { id: true, success: true },
      }),
    );

    if (!latestResult || latestResult.id !== processResultId) {
      return {
        message: `Skipped: result ${processResultId} superseded by a newer run`,
      };
    }

    if (!latestResult.success) {
      return {
        message: `Skipped: result ${processResultId} was not successful`,
      };
    }

    const selectedProposalIds = await step.run(
      'get-selected-proposal-ids',
      async () => {
        const rows = await db
          .select({ proposalId: decisionProcessResultSelections.proposalId })
          .from(decisionProcessResultSelections)
          .where(
            eq(
              decisionProcessResultSelections.processResultId,
              processResultId,
            ),
          );

        return rows.map((r) => r.proposalId);
      },
    );

    // Every submitted (non-draft) proposal's authors get an outcome email —
    // collaborators are members of the proposal's own profile.
    const recipients = await step.run('get-recipients', async () => {
      const proposalProfile = alias(profiles, 'proposal_profile');

      const rows = await db
        .select({
          proposalId: proposals.id,
          proposalProfileId: proposals.profileId,
          proposalName: proposalProfile.name,
          email: profileUsers.email,
        })
        .from(proposals)
        .innerJoin(proposalProfile, eq(proposals.profileId, proposalProfile.id))
        .innerJoin(
          profileUsers,
          eq(profileUsers.profileId, proposals.profileId),
        )
        .where(
          and(
            eq(proposals.processInstanceId, processInstanceId),
            ne(proposals.status, ProposalStatus.DRAFT),
            isNull(proposals.deletedAt),
            isNull(proposals.moderationDetachedAt),
            isNotNull(profileUsers.email),
          ),
        );

      return rows.filter(hasEmail);
    });

    if (recipients.length === 0) {
      logger.warn('No proposal authors found for process instance', {
        processInstanceId,
      });
      return;
    }

    const selectedSet = new Set(selectedProposalIds);
    const baseUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${processData.profileSlug}`;

    const result = await step.run('send-emails', async () => {
      try {
        const emails = recipients.map(
          ({ proposalId, proposalProfileId, proposalName, email }) => {
            const selected = selectedSet.has(proposalId);

            return {
              to: email,
              subject: SelectionDecisionEmail.subject(
                processData.name,
                selected,
              ),
              component: () =>
                SelectionDecisionEmail({
                  proposalName,
                  processTitle: processData.name,
                  selected,
                  proposalUrl: `${baseUrl}/proposal/${proposalProfileId}`,
                }),
            };
          },
        );

        const { data, errors } = await OPBatchSend(emails);

        if (errors.length > 0) {
          throw Error(`Email batch failed: ${JSON.stringify(errors)}`);
        }

        return {
          sent: data.length,
        };
      } catch (error) {
        logger.error('Failed to send selection decision notifications', {
          error,
          processInstanceId,
          processResultId,
        });
        throw error;
      }
    });

    return {
      message: `${result.sent} selection decision notification(s) sent`,
    };
  },
);
