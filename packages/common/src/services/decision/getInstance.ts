import { db } from '@op/db/client';
import { logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { getCachedInstance } from './getCachedInstance';
import { type Phase, toPhaseInstanceData, toPhases } from './instancePhases';
import { listPhases } from './phaseHelpers';
import { resolveInstanceAccess } from './resolveInstanceAccess';
import { resolveManualSelectionStatus } from './resolveManualSelectionStatus';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface GetInstanceInput {
  instanceId: string;
  user: User | undefined;
}

export const getInstance = async ({ instanceId, user }: GetInstanceInput) => {
  try {
    // Cached and viewer-independent; the access check + per-user access bits
    // below run on every call, outside the cache.
    const cached = await getCachedInstance(instanceId);

    if (!cached) {
      throw new NotFoundError('Process instance', instanceId);
    }

    const [storedPhases, profileRoles] = await Promise.all([
      listPhases({ db, processInstanceId: cached.id }),
      assertInstanceProfileAccess({
        user,
        instance: cached,
        profilePermissions: { decisions: permission.READ },
        orgFallbackPermissions: { decisions: permission.READ },
      }),
    ]);
    const allPhases = toPhases({ instance: cached, storedPhases });
    const instance = {
      ...cached,
      phases: allPhases.map(toPhaseInstanceData),
    };

    // Resolve access capabilities for the current user.
    // profileId is guaranteed non-null here: assertInstanceProfileAccess throws above if null.
    if (!instance.profileId) {
      throw new NotFoundError('Process instance', instanceId);
    }
    const access = await resolveInstanceAccess({
      user,
      instance: {
        profileId: instance.profileId,
        ownerProfileId: instance.ownerProfileId,
      },
      profileRoles,
    });

    // Filter budget from phase settings if hideBudget is true
    const instanceData = instance.instanceData as DecisionInstanceData;
    const hideBudget = instanceData.config?.hideBudget;
    const applyHideBudget = (phase: Phase): Phase =>
      hideBudget && phase.settings
        ? { ...phase, settings: { ...phase.settings, budget: undefined } }
        : phase;
    const visiblePhases = allPhases.map(applyHideBudget);
    const phases = visiblePhases.map(toPhaseInstanceData);

    const manualSelectionStatus = await resolveManualSelectionStatus({
      instance,
    });

    return {
      ...instance,
      slug: instance.profile?.slug ?? null,
      instanceData,
      phases,
      // Not on `phases`: a builder save persists every PhaseInstanceData key.
      phasesWithIds: visiblePhases,
      access,
      selectionsAreConfirmed: manualSelectionStatus.selectionsAreConfirmed,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    logger.error('Error fetching process instance', { error });
    throw new NotFoundError('Process instance', instanceId);
  }
};
