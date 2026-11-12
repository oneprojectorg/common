import { db } from '@op/db/client';
import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError, ValidationError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';
import { assertUserByAuthId } from '../assert';
import { decisionPermission } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';
import { isDevelopPhase } from './utils/phaseSettings';

type DevelopInstance = {
  id: string;
  profileId: string | null;
  instanceData: Pick<DecisionInstanceData, 'phases'>;
};

const DECISION_ADMIN = [
  { profile: permission.ADMIN },
  { decisions: permission.ADMIN },
];

/** Whether `phaseId` is a develop phase of the instance. */
export function isDevelopPhaseById({
  instance,
  phaseId,
}: {
  instance: { instanceData: Pick<DecisionInstanceData, 'phases'> };
  phaseId: string | null;
}): boolean {
  const phase = instance.instanceData.phases.find((p) => p.phaseId === phaseId);
  return phase !== undefined && isDevelopPhase(phase);
}

/**
 * Asserts the caller may work on proposals in a develop phase: a decision
 * admin of the instance profile (no org fallback), or a caller with the
 * Review permission who is a category reviewer for this exact phase. The
 * category of the row is not matched against the proposal's category yet.
 *
 * This rule (admin, or Review plus a category assignment for the phase) will
 * most likely become a capability, possibly before launch.
 */
export async function assertProposalDevelopAccess({
  instance,
  phaseId,
  user,
}: {
  instance: DevelopInstance;
  phaseId: string;
  user: AccessUser;
}): Promise<void> {
  const phaseName =
    instance.instanceData.phases.find((p) => p.phaseId === phaseId)?.name ??
    'Unknown';
  const notAllowed = new ValidationError(
    `Proposals are not allowed in the ${phaseName} phase`,
  );

  if (!instance.profileId) {
    throw notAllowed;
  }

  const roles = await getProfileAccessRoles({
    user,
    profileId: instance.profileId,
  });

  if (checkPermission(DECISION_ADMIN, roles)) {
    return;
  }

  if (!checkPermission({ decisions: decisionPermission.REVIEW }, roles)) {
    throw notAllowed;
  }

  if (!(await isPhaseCategoryReviewer({ instance, phaseId, user }))) {
    throw new UnauthorizedError(
      'You have no category assignment for this phase, so you cannot create or submit proposals in it',
    );
  }
}

async function isPhaseCategoryReviewer({
  instance,
  phaseId,
  user,
}: {
  instance: { id: string };
  phaseId: string;
  user: AccessUser;
}): Promise<boolean> {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.profileId) {
    return false;
  }

  // NULL-phase rows scope reviewing only and must not grant the right to
  // create proposals.
  const row = await db.query.categoryReviewers.findFirst({
    where: {
      processInstanceId: instance.id,
      reviewerProfileId: dbUser.profileId,
      phaseId,
    },
    columns: { id: true },
  });

  return row !== undefined;
}
