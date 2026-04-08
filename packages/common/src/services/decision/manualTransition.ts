import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import type { DecisionProcess } from '@op/db/schema';
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
import { advancePhase } from './advancePhase';
import { processResults } from './processResults';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProcessSchema } from './types';

export interface ManualTransitionInput {
  instanceId: string;
  user: User;
  /**
   * The phase the caller observed as current. If provided, the transition only
   * proceeds when the instance is actually on this phase. If the instance has
   * already moved on (e.g. concurrent admin click, retry of a stale request),
   * a ConflictError is thrown so the caller can refetch and re-decide.
   */
  currentPhaseId?: string;
}

export interface ManualTransitionResult {
  instanceId: string;
  currentPhaseId: string;
  previousPhaseId: string;
}

/**
 * Manually advance a decision instance from its current phase to the next phase.
 * Validates admin access and instance eligibility, then delegates the actual
 * phase advance to the shared `advancePhase` core function.
 *
 * On the final phase: additionally runs processResults to store final selections
 * in the results tables and update proposal statuses.
 */
export async function manualTransition({
  instanceId,
  user,
  currentPhaseId: expectedFromPhaseId,
}: ManualTransitionInput): Promise<ManualTransitionResult> {
  // assertUserByAuthId and the instance fetch are independent — run in parallel
  // to save one round trip. getProfileAccessUser below still needs to wait on
  // the instance fetch for profileId.
  const [dbUser, instance] = await Promise.all([
    assertUserByAuthId(user.id),
    db.query.processInstances.findFirst({
      where: { id: instanceId },
      with: { process: true },
    }),
  ]);

  if (!dbUser.currentProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

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

  if (instance.status !== ProcessStatus.PUBLISHED) {
    throw new ValidationError('Instance must be published');
  }

  const instanceData = instance.instanceData as DecisionInstanceData;
  const phases = instanceData.phases;

  if (!phases || phases.length === 0) {
    throw new CommonError('Instance has no phases defined');
  }

  const fromPhaseId = instanceData.currentPhaseId;

  if (!fromPhaseId) {
    throw new CommonError('Instance has no current phase set');
  }

  // Strict idempotency check: if the caller told us which phase they observed,
  // refuse to advance unless the instance is still on that phase. This prevents
  // double-clicks and stale retries from advancing through multiple phases.
  if (expectedFromPhaseId && expectedFromPhaseId !== fromPhaseId) {
    throw new ConflictError(
      `Instance is on phase '${fromPhaseId}', not '${expectedFromPhaseId}'`,
    );
  }

  const currentPhaseIndex = phases.findIndex((p) => p.phaseId === fromPhaseId);

  if (currentPhaseIndex === -1) {
    throw new CommonError('Current phase not found in instance phases');
  }

  if (currentPhaseIndex === phases.length - 1) {
    throw new ValidationError('Already on final phase');
  }

  const nextPhase = phases[currentPhaseIndex + 1]!;
  const toPhaseId = nextPhase.phaseId;
  const isTransitioningToFinalPhase =
    currentPhaseIndex + 1 === phases.length - 1;

  const process = instance.process as DecisionProcess;
  const processSchema = process?.processSchema as ProcessSchema | undefined;

  await db.transaction(async (tx) => {
    const result = await advancePhase({
      tx,
      instance: {
        id: instance.id,
        processId: instance.processId,
        instanceData,
      },
      processSchema,
      fromPhaseId,
      toPhaseId,
      triggeredByProfileId: dbUser.currentProfileId,
      transitionData: { manual: true },
    });

    if (result.conflict) {
      throw new CommonError(
        'Phase was already advanced, or instance is no longer published',
      );
    }
  });

  // processResults runs as a separate top-level operation: the join table
  // writes inside advancePhase are per-transition, while processResults
  // populates decisionProcessResults + selections + proposal statuses.
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
    currentPhaseId: toPhaseId,
    previousPhaseId: fromPhaseId,
  };
}
