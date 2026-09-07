import { and, db, desc, eq, inArray } from '@op/db/client';
import {
  ProcessStatus,
  decisionTransitionProposals,
  proposalHistory,
  stateTransitionHistory,
} from '@op/db/schema';
import { Events, event } from '@op/events';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { isLegacyInstanceData } from './isLegacyInstance';
import { lockProcessInstance } from './lockProcessInstance';
import { processResults } from './processResults';
import {
  RESULT_NOTIFICATION_MESSAGE_MAX_LENGTH,
  type ResultNotificationMessages,
  resultNotificationMessagesSchema,
} from './resultNotificationTemplate';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
import { type DecisionInstanceData, isLastPhase } from './schemas/instanceData';
import type {
  ManualSelectionAudit,
  TransitionData,
} from './schemas/transitionData';
import { isReviewPhase } from './utils/phaseSettings';

export interface SubmitManualSelectionInput {
  processInstanceId: string;
  proposalIds: string[];
  /**
   * The funded / not-funded messages to send proposal authors. Only meaningful
   * on the final phase, where this call publishes results — passing them off it
   * is rejected rather than silently discarded. Omitting them there publishes
   * without notifying anyone, which is what the review-selection flow does.
   */
  resultNotifications?: ResultNotificationMessages;
  user: User;
}

/**
 * Admin-driven manual selection for the current phase's inbound transition.
 *
 * One-shot: UPDATEs the existing `stateTransitionHistory` row (stamping
 * `transitionData.manualSelection`) and attaches the chosen proposals.
 * `SELECT ... FOR UPDATE` serializes concurrent submits; throws `ConflictError`
 * if the latest transition is no longer into `currentStateId`.
 */
export async function submitManualSelection({
  processInstanceId,
  proposalIds,
  resultNotifications,
  user,
}: SubmitManualSelectionInput): Promise<void> {
  const uniqueProposalIds = [...new Set(proposalIds)];

  const [dbUser, instance] = await Promise.all([
    assertUserByAuthId(user.id),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
    }),
  ]);

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  if (instance.status !== ProcessStatus.PUBLISHED) {
    throw new ValidationError(
      'Manual selection is only available for published instances',
    );
  }

  const currentStateId = instance.currentStateId;
  if (!currentStateId) {
    throw new ValidationError('Instance has no current phase set');
  }

  if (isLegacyInstanceData(instance.instanceData)) {
    throw new ValidationError(
      'Manual selection is not available for this instance',
    );
  }

  // Shape-checked before the transaction opens: blank or oversized email copy
  // is the admin's mistake to fix, and the rejection must land before anything
  // publishes. Whether this phase publishes at all is decided under the lock.
  const composedNotifications = resultNotifications
    ? parseResultNotifications(resultNotifications)
    : undefined;

  const now = new Date().toISOString();
  const byProfileId = dbUser.profileId;
  let previousPhaseId: string | null = null;
  let processResultId: string | null = null;
  let transitionHistoryId: string | null = null;
  let reviewAssignmentInput:
    | Parameters<typeof runGenerateReviewAssignments>[0]
    | null = null;

  await db.transaction(async (tx) => {
    // Lock the instance row so a concurrent advancePhase can't move the
    // phase out from under us, then re-verify state inside the lock.
    const lockedInstance = await lockProcessInstance({
      db: tx,
      instanceId: processInstanceId,
    });

    if (!lockedInstance) {
      throw new NotFoundError('Process instance', processInstanceId);
    }

    if (lockedInstance.status !== ProcessStatus.PUBLISHED) {
      throw new ConflictError(
        'Instance is no longer published; refresh and retry',
      );
    }

    if (lockedInstance.currentStateId !== currentStateId) {
      throw new ConflictError(
        'Instance has advanced since selection started; refresh and retry',
      );
    }

    const lockedData =
      lockedInstance.instanceData as DecisionInstanceData | null;
    const lockedPhases = lockedData?.phases;
    const lockedPhaseIndex =
      lockedPhases?.findIndex((p) => p.phaseId === currentStateId) ?? -1;
    const lockedPreviousPhase =
      lockedPhases && lockedPhaseIndex > 0
        ? lockedPhases[lockedPhaseIndex - 1]
        : undefined;
    if (!lockedPreviousPhase) {
      throw new ValidationError(
        'Manual selection is not available for this instance',
      );
    }
    const lockedPreviousPhaseId = lockedPreviousPhase.phaseId;

    const [latestRow] = await tx
      .select({
        id: stateTransitionHistory.id,
        toStateId: stateTransitionHistory.toStateId,
        transitionData: stateTransitionHistory.transitionData,
        triggeredByProfileId: stateTransitionHistory.triggeredByProfileId,
      })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, processInstanceId))
      .orderBy(desc(stateTransitionHistory.transitionedAt))
      .limit(1)
      .for('update');

    if (!latestRow || latestRow.toStateId !== currentStateId) {
      throw new ConflictError(
        'Instance has advanced since selection started; refresh and retry',
      );
    }

    const existingTransitionData =
      (latestRow.transitionData as TransitionData | null | undefined) ?? {};
    const hasManualSelectionStamp = Boolean(
      existingTransitionData.manualSelection,
    );

    if (hasManualSelectionStamp) {
      throw new ConflictError(
        'Manual selection has already been submitted for this phase',
      );
    }

    const attachedRows = await tx
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.transitionHistoryId, latestRow.id));

    // Can't overwrite a pipeline-driven transition that already attached proposals.
    if (attachedRows.length > 0) {
      throw new ValidationError(
        'Manual selection is not available for this instance',
      );
    }

    const candidateIds = new Set(
      await getProposalIdsForPhase({
        instance: {
          id: processInstanceId,
          instanceData: lockedInstance.instanceData,
          currentStateId: lockedInstance.currentStateId,
        },
        phaseId: lockedPreviousPhaseId,
        db: tx,
      }),
    );
    for (const id of uniqueProposalIds) {
      if (!candidateIds.has(id)) {
        throw new ValidationError(
          `Proposal ${id} is not an eligible manual-selection candidate`,
        );
      }
    }

    const manualSelectionAudit: ManualSelectionAudit = {
      byProfileId,
      at: now,
      // Stamped here, not carried in the notification event: the results these
      // messages describe commit in this same transaction, so a failed event
      // send must cost delivery rather than the record of what was written.
      ...(composedNotifications
        ? { resultNotifications: composedNotifications }
        : {}),
    };

    const nextTransitionData: TransitionData = {
      ...existingTransitionData,
      manualSelection: manualSelectionAudit,
    };

    // Preserve existing attribution; manualSelection.byProfileId already stamps the confirmer.
    await tx
      .update(stateTransitionHistory)
      .set({
        transitionData: nextTransitionData,
        ...(latestRow.triggeredByProfileId == null
          ? { triggeredByProfileId: byProfileId }
          : {}),
      })
      .where(eq(stateTransitionHistory.id, latestRow.id));

    const latestHistoryRows = await tx
      .selectDistinctOn([proposalHistory.id], {
        proposalId: proposalHistory.id,
        historyId: proposalHistory.historyId,
      })
      .from(proposalHistory)
      .where(
        and(
          eq(proposalHistory.processInstanceId, processInstanceId),
          inArray(proposalHistory.id, uniqueProposalIds),
        ),
      )
      .orderBy(proposalHistory.id, desc(proposalHistory.historyCreatedAt));

    if (latestHistoryRows.length !== uniqueProposalIds.length) {
      throw new CommonError(
        `Proposals missing history records during manual selection for instance ${processInstanceId}: expected ${uniqueProposalIds.length}, got ${latestHistoryRows.length}`,
      );
    }

    await tx.insert(decisionTransitionProposals).values(
      latestHistoryRows.map(({ proposalId, historyId }) => ({
        processInstanceId,
        transitionHistoryId: latestRow.id,
        proposalId,
        proposalHistoryId: historyId,
      })),
    );

    // Defer review-assignment generation until after the transaction commits:
    // generateReviewAssignments reads the just-attached decisionTransitionProposals
    // rows and writes assignments on the pooled `db` connection, which can't see
    // this transaction's uncommitted writes (mirrors onPhaseAdvanced's ordering).
    const currentPhase = lockedPhases?.[lockedPhaseIndex];
    if (lockedPhases && currentPhase && isReviewPhase(currentPhase)) {
      reviewAssignmentInput = {
        instanceId: processInstanceId,
        fromPhaseId: lockedPreviousPhaseId,
        toPhaseId: currentStateId,
        phases: lockedPhases,
        advanceResult: {
          conflict: false,
          transitionHistoryId: latestRow.id,
          selectedProposalIds: uniqueProposalIds,
        },
      };
    }

    // Results only publish on the last phase, so that is the only place author
    // notifications mean anything. Rejected rather than silently dropped: copy
    // arriving here would never be sent and the admin would never know.
    const publishesResults = isLastPhase(currentStateId, lockedPhases ?? []);
    if (composedNotifications && !publishesResults) {
      throw new ValidationError(
        'Author notifications are only sent when confirming the final phase',
      );
    }

    // On the final phase, fold results processing into this transaction so
    // the new result row is atomic with the attachment write.
    if (publishesResults) {
      processResultId = await processResults({
        processInstanceId,
        tx,
        instance: {
          id: processInstanceId,
          instanceData: lockedInstance.instanceData,
          currentStateId: lockedInstance.currentStateId,
        },
      });
    }

    previousPhaseId = lockedPreviousPhaseId;
    transitionHistoryId = latestRow.id;
  });

  // Runs after commit so generateReviewAssignments sees the attached proposals
  // and its writes aren't orphaned if the transaction had rolled back. Failures
  // are logged, not thrown.
  if (reviewAssignmentInput) {
    await runGenerateReviewAssignments(reviewAssignmentInput);
  }

  if (previousPhaseId) {
    event
      .send({
        name: Events.manualSelectionsConfirmed.name,
        data: {
          processInstanceId,
          fromPhaseId: previousPhaseId,
          toPhaseId: currentStateId,
        },
      })
      .catch((err) => {
        logger.error('Failed to send manual selections confirmed event', {
          processInstanceId,
          error: err,
        });
      });

    // Both halves required: results were published AND an admin composed the
    // copy to announce them with.
    //
    // Awaited, unlike the send above: publishing is one-shot (a second submit
    // hits the manual-selection stamp and throws), so a send dropped when the
    // serverless isolate freezes would leave every author unnotified with no
    // way to retry. The results are already committed, so a failure here is
    // logged rather than thrown.
    if (processResultId && transitionHistoryId && composedNotifications) {
      try {
        await event.send({
          name: Events.decisionResultsNotified.name,
          data: {
            processInstanceId,
            processResultId,
            transitionHistoryId,
            previousPhaseId,
          },
        });
      } catch (err) {
        logger.error('Failed to send decision results notified event', {
          processInstanceId,
          processResultId,
          error: err,
        });
      }
    }
  }
}

/**
 * Trims and bounds the composed author messages. Asserted here rather than
 * trusted from the router because this is a public `@op/common` entry point and
 * every other gate in it is asserted here too.
 */
function parseResultNotifications(
  resultNotifications: ResultNotificationMessages,
): ResultNotificationMessages {
  const parsed =
    resultNotificationMessagesSchema.safeParse(resultNotifications);

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    throw new ValidationError(
      `${String(field ?? 'notification')} message must be between 1 and ${RESULT_NOTIFICATION_MESSAGE_MAX_LENGTH} characters`,
    );
  }

  return parsed.data;
}
