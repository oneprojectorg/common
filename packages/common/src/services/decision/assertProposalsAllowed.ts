import { db, eq } from '@op/db/client';
import { organizations } from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError, ValidationError } from '../../utils';
import {
  type AccessUser,
  getOrgAccessUser,
  getProfileAccessRoles,
} from '../access';
import { assertUserByAuthId } from '../assert';
import { decisionPermission } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';
import { isDevelopPhase } from './utils/phaseSettings';
import { checkProposalsAllowed } from './utils/proposal';

type ProposalInstance = {
  id: string;
  profileId: string | null;
  ownerProfileId: string | null;
  instanceData: Pick<DecisionInstanceData, 'phases'>;
};

const DECISION_ADMIN = [
  { profile: permission.ADMIN },
  { decisions: permission.ADMIN },
];

/**
 * Whether `phaseId` is a develop phase of the instance. In a develop phase
 * {@link assertProposalsAllowed} is the whole authorization, so callers skip
 * their own access check.
 */
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
 * Asserts the caller may create or submit a proposal in the instance's
 * current phase.
 *
 * Outside a develop phase the phase submit rule applies; the caller has
 * already checked access. In a develop phase only decision admins, or callers
 * with the Review permission who are category reviewers for that exact phase,
 * may create or submit proposals there. The category of the row is not
 * matched against the proposal's category yet.
 */
export async function assertProposalsAllowed({
  instance,
  phaseId,
  user,
}: {
  instance: ProposalInstance;
  phaseId: string;
  user: AccessUser;
}): Promise<void> {
  const { allowed, phaseName } = checkProposalsAllowed(
    instance.instanceData.phases,
    phaseId,
  );
  const notAllowed = new ValidationError(
    `Proposals are not allowed in the ${phaseName} phase`,
  );

  if (!isDevelopPhaseById({ instance, phaseId })) {
    if (!allowed) {
      throw notAllowed;
    }
    return;
  }

  if (!instance.profileId) {
    throw notAllowed;
  }

  const roles = await getProfileAccessRoles({
    user,
    profileId: instance.profileId,
  });

  if (
    checkPermission(DECISION_ADMIN, roles) ||
    (await isOrgAdmin({ ownerProfileId: instance.ownerProfileId, user }))
  ) {
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

/** The org fallback of the create check: an admin of the owning organization. */
async function isOrgAdmin({
  ownerProfileId,
  user,
}: {
  ownerProfileId: string | null;
  user: AccessUser;
}): Promise<boolean> {
  if (!ownerProfileId) {
    return false;
  }

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.profileId, ownerProfileId));

  if (!org) {
    return false;
  }

  const orgUser = await getOrgAccessUser({ user, organizationId: org.id });
  return checkPermission({ profile: permission.ADMIN }, orgUser?.roles ?? []);
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
