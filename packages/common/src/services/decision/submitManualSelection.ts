import { and, db, desc, eq, inArray } from '@op/db/client';
import {
  ProcessStatus,
  decisionTransitionProposals,
  processInstances,
  proposalHistory,
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
import { getProposalIdsForPhase } from './getProposalsForPhase';
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
    // Lock the instance row so a concurrent advancePhase can't move the
    // phase out from under us, then re-verify state inside the lock.
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

    // Can't overwrite a pipeline-driven transition that already attached proposals.
    if (attachedRows.length > 0) {
      throw new ValidationError(
        'Manual selection is not available for this instance',
      );
    }

    const candidateIds = new Set(
      await getProposalIdsForPhase({
        instanceId: processInstanceId,
        phaseId: previousPhaseId,
        dbClient: tx,
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

    return {
      transitionHistoryId: latestRow.id,
      proposalIds: uniqueProposalIds,
    };
  });
}
