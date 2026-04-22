import { and, db, desc, eq, inArray, isNull, ne } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  proposalHistory,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { isLegacyInstanceData } from './isLegacyInstance';
import type { DecisionInstanceData } from './schemas/instanceData';
import type {
  ManualSelectionAudit,
  TransitionData,
} from './schemas/transitionData';

export interface SubmitManualSelectionInput {
  processInstanceId: string;
  proposalIds: string[];
  user: User;
}

export interface SubmitManualSelectionResult {
  transitionHistoryId: string;
  proposalIds: string[];
}

/**
 * Admin-driven manual selection of proposals to populate the current phase when
 * the automatic selection pipeline produced zero advanced proposals.
 *
 * UPDATEs the existing `stateTransitionHistory` row that brought the instance
 * into its current phase, stamping `transitionData.manualSelection` and
 * attaching the chosen `decisionTransitionProposals`. One-shot only —
 * rejects if the transition already has a manual selection stamp.
 *
 * The target row is located via `SELECT ... FOR UPDATE`, which serializes
 * concurrent submissions. Rejects with `ConflictError` if the latest
 * transition is no longer into `currentStateId` (phase advanced under us).
 */
export async function submitManualSelection({
  processInstanceId,
  proposalIds,
  user,
}: SubmitManualSelectionInput): Promise<SubmitManualSelectionResult> {
  if (proposalIds.length === 0) {
    throw new ValidationError('At least one proposal must be selected');
  }

  const uniqueProposalIds = [...new Set(proposalIds)];

  const [dbUser, instance] = await Promise.all([
    assertUserByAuthId(user.id),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
    }),
  ]);

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });

  assertAccess({ decisions: permission.ADMIN }, profileUser?.roles ?? []);

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

  const now = new Date().toISOString();
  const byProfileId = dbUser.profileId;

  return db.transaction(async (tx) => {
    // Serialize against advancePhase: lock the instance row first and
    // re-verify currentStateId + status + instanceData inside the tx so
    // a concurrent advance / status change / phases edit cannot slip
    // between our outer-tx read and our writes.
    const [lockedInstance] = await tx
      .select({
        currentStateId: processInstances.currentStateId,
        status: processInstances.status,
        instanceData: processInstances.instanceData,
      })
      .from(processInstances)
      .where(eq(processInstances.id, processInstanceId))
      .limit(1)
      .for('update');

    if (!lockedInstance) {
      throw new NotFoundError('Process instance not found');
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
    const previousPhaseId = lockedPreviousPhase.phaseId;

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

    // Manual selection is applicable only when the inbound transition is
    // empty — a pipeline-driven transition with attached proposals is
    // not editable here.
    if (attachedRows.length > 0) {
      throw new ValidationError(
        'Manual selection is not available for this instance',
      );
    }

    const [previousTransition] = await tx
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(
        and(
          eq(stateTransitionHistory.processInstanceId, processInstanceId),
          eq(stateTransitionHistory.toStateId, previousPhaseId),
        ),
      )
      .orderBy(desc(stateTransitionHistory.transitionedAt))
      .limit(1);

    const candidateRows = previousTransition
      ? await tx
          .select({ id: proposals.id })
          .from(decisionTransitionProposals)
          .innerJoin(
            proposals,
            eq(decisionTransitionProposals.proposalId, proposals.id),
          )
          .where(
            and(
              eq(
                decisionTransitionProposals.transitionHistoryId,
                previousTransition.id,
              ),
              ne(proposals.status, ProposalStatus.DRAFT),
              isNull(proposals.deletedAt),
            ),
          )
      : await tx
          .select({ id: proposals.id })
          .from(proposals)
          .where(
            and(
              eq(proposals.processInstanceId, processInstanceId),
              ne(proposals.status, ProposalStatus.DRAFT),
              isNull(proposals.deletedAt),
            ),
          );

    const candidateIds = new Set(candidateRows.map((r) => r.id));
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
    };

    const nextTransitionData: TransitionData = {
      ...existingTransitionData,
      manualSelection: manualSelectionAudit,
    };

    // Only fill triggeredByProfileId if the transition was system-triggered
    // (e.g. a cron advance set it to null). Don't overwrite an existing
    // attribution — `manualSelection.byProfileId` stamps the confirmer
    // independently.
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

    return {
      transitionHistoryId: latestRow.id,
      proposalIds: uniqueProposalIds,
    };
  });
}
