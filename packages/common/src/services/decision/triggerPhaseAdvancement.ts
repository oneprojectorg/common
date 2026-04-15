import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
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
import { onPhaseAdvanced } from './onPhaseAdvanced';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface TriggerPhaseAdvancementInput {
  instanceId: string;
  user: User;
  /**
   * The phase the caller observed as current. If provided, the transition only
   * proceeds when the instance is actually on this phase. If the instance has
   * already moved on (e.g. concurrent admin click, retry of a stale request),
   * a ConflictError is thrown so the caller can refetch and re-decide.
   */
  fromPhaseId?: string;
}

export interface TriggerPhaseAdvancementResult {
  currentPhaseId: string;
  previousPhaseId: string;
}

/**
 * Manually advance a decision instance from its current phase to the next phase.
 * Validates admin access and instance eligibility, then delegates the actual
 * phase advance to the shared `advancePhase` core function.
 */
export async function triggerPhaseAdvancement({
  instanceId,
  user,
  fromPhaseId: expectedFromPhaseId,
}: TriggerPhaseAdvancementInput): Promise<TriggerPhaseAdvancementResult> {
  const [dbUser, instance] = await Promise.all([
    assertUserByAuthId(user.id),
    db.query.processInstances.findFirst({
      where: { id: instanceId },
    }),
  ]);

  if (!dbUser.profileId) {
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

  const fromPhaseId = instance.currentStateId;

  if (!fromPhaseId) {
    throw new CommonError('Instance has no current phase set');
  }

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

  const toPhaseId = phases[currentPhaseIndex + 1]!.phaseId;

  const advanceResult = await db.transaction(async (tx) => {
    const result = await advancePhase({
      tx,
      instance: {
        id: instance.id,
        instanceData,
      },
      fromPhaseId,
      toPhaseId,
      triggeredByProfileId: dbUser.profileId,
      transitionData: { manual: true },
    });

    if (result.conflict) {
      throw new ConflictError('Phase transition conflict');
    }

    return result;
  });

  await onPhaseAdvanced({
    instanceId,
    fromPhaseId,
    toPhaseId,
    phases,
    advanceResult,
  });

  return {
    currentPhaseId: toPhaseId,
    previousPhaseId: fromPhaseId,
  };
}
