import { db } from '@op/db/client';
import { checkPermission } from 'access-zones';

import { ValidationError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';
import { assertUserByAuthId } from '../assert';
import { decisionPermission } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';
import { isDevelopPhase } from './utils/phaseSettings';
import { checkProposalsAllowed } from './utils/proposal';

/**
 * Asserts the caller may create or submit a proposal in the instance's
 * current phase. A develop phase ignores the phase submit rule: only callers
 * with the REVIEW capability who are mapped as category reviewers for that
 * exact phase may author ballot entries there.
 */
export async function assertProposalsAllowed({
  instance,
  phaseId,
  user,
}: {
  instance: {
    id: string;
    profileId: string | null;
    instanceData: Pick<DecisionInstanceData, 'phases'>;
  };
  phaseId: string;
  user: AccessUser;
}): Promise<void> {
  const { phases } = instance.instanceData;
  const { allowed, phaseName } = checkProposalsAllowed(phases, phaseId);
  const notAllowed = new ValidationError(
    `Proposals are not allowed in the ${phaseName} phase`,
  );
  const phase = phases.find((p) => p.phaseId === phaseId);

  if (!phase || !isDevelopPhase(phase)) {
    if (!allowed) {
      throw notAllowed;
    }
    return;
  }

  if (!(await isPhaseFacilitator({ instance, phaseId, user }))) {
    throw notAllowed;
  }
}

async function isPhaseFacilitator({
  instance,
  phaseId,
  user,
}: {
  instance: { id: string; profileId: string | null };
  phaseId: string;
  user: AccessUser;
}): Promise<boolean> {
  if (!instance.profileId) {
    return false;
  }

  const [roles, dbUser] = await Promise.all([
    getProfileAccessRoles({ user, profileId: instance.profileId }),
    assertUserByAuthId(user.id),
  ]);

  if (
    !dbUser.profileId ||
    !checkPermission({ decisions: decisionPermission.REVIEW }, roles)
  ) {
    return false;
  }

  // Exact phase match: instance-wide rows (`phaseId` NULL) scope reviewing
  // only and must not grant the right to author entries.
  const mapping = await db.query.categoryReviewers.findFirst({
    where: {
      processInstanceId: instance.id,
      reviewerProfileId: dbUser.profileId,
      phaseId,
    },
    columns: { id: true },
  });

  return mapping !== undefined;
}
