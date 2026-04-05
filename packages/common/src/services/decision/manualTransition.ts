import { and, db, eq, isNull } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { processResults } from './processResults';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface ManualTransitionInput {
  instanceId: string;
  user: User;
}

export interface ManualTransitionResult {
  instanceId: string;
  currentPhaseId: string;
  previousPhaseId: string;
}

/**
 * Manually advance a decision instance from its current phase to the next phase.
 * Validates admin access, instance eligibility, and executes the transition atomically.
 * When reaching the final phase, processes results (selection pipeline).
 */
export async function manualTransition({
  instanceId,
  user,
}: ManualTransitionInput): Promise<ManualTransitionResult> {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  // Fetch the instance
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  // Validate admin access
  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });

  assertAccess({ decisions: permission.ADMIN }, profileUser?.roles ?? []);

  // Validate instance is eligible for transition
  if (instance.status !== ProcessStatus.PUBLISHED) {
    throw new ValidationError('Instance must be published');
  }

  const instanceData = instance.instanceData as DecisionInstanceData;
  const phases = instanceData.phases;

  if (!phases || phases.length === 0) {
    throw new CommonError('Instance has no phases defined');
  }

  const currentPhaseId = instanceData.currentPhaseId;

  if (!currentPhaseId) {
    throw new CommonError('Instance has no current phase set');
  }

  const currentPhaseIndex = phases.findIndex(
    (p) => p.phaseId === currentPhaseId,
  );

  if (currentPhaseIndex === -1) {
    throw new CommonError('Current phase not found in instance phases');
  }

  if (currentPhaseIndex === phases.length - 1) {
    throw new ValidationError('Already on final phase');
  }

  const nextPhase = phases[currentPhaseIndex + 1]!;
  const nextPhaseId = nextPhase.phaseId;
  const isTransitioningToFinalPhase =
    currentPhaseIndex + 1 === phases.length - 1;
  const now = new Date().toISOString();

  const stateData = (instanceData as unknown as Record<string, unknown>)
    .stateData as Record<string, unknown> | undefined;

  const updatedInstanceData = {
    ...instanceData,
    currentPhaseId: nextPhaseId,
    stateData: {
      ...stateData,
      [nextPhaseId]: { enteredAt: now, metadata: { manual: true } },
    },
  };

  // Execute transition atomically
  await db.transaction(async (tx) => {
    // Optimistic lock on currentStateId prevents concurrent double-advances.
    const updated = await tx
      .update(processInstances)
      .set({
        currentStateId: nextPhaseId,
        updatedAt: now,
        instanceData: updatedInstanceData,
      })
      .where(
        and(
          eq(processInstances.id, instanceId),
          eq(processInstances.currentStateId, currentPhaseId),
        ),
      )
      .returning({ id: processInstances.id });

    if (updated.length === 0) {
      throw new CommonError('Phase was already advanced by another request');
    }

    // Mark any pending scheduled transition for the current phase as completed
    await tx
      .update(decisionProcessTransitions)
      .set({ completedAt: now })
      .where(
        and(
          eq(decisionProcessTransitions.processInstanceId, instanceId),
          eq(decisionProcessTransitions.fromStateId, currentPhaseId),
          isNull(decisionProcessTransitions.completedAt),
        ),
      );

    // Record in transition history
    await tx.insert(stateTransitionHistory).values({
      processInstanceId: instanceId,
      fromStateId: currentPhaseId,
      toStateId: nextPhaseId,
      transitionData: { manual: true },
      triggeredByProfileId: dbUser.currentProfileId,
    });
  });

  // Process results when transitioning to the final phase.
  // processResults runs outside the transaction — if it fails, the instance
  // remains on the final phase. processResults is internally idempotent so
  // it can be retried separately; we log the error but do not fail the
  // transition itself since the phase advancement already committed.
  if (isTransitioningToFinalPhase) {
    try {
      await processResults({ processInstanceId: instanceId });
    } catch (err) {
      console.error(
        `processResults failed for instance ${instanceId} after manual transition to final phase:`,
        err,
      );
    }
  }

  return {
    instanceId,
    currentPhaseId: nextPhaseId,
    previousPhaseId: currentPhaseId,
  };
}
