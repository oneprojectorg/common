import { type SQL, and, db, eq, exists, isNull, sql } from '@op/db/client';
import { proposalReviewAssignments, type proposals } from '@op/db/schema';

import { UnauthorizedError } from '../../utils';
import type { AccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import type { PhaseInstanceData } from './schemas/instanceData';

/** A correlated predicate on the proposal row, so it rides in a WHERE clause. */
export type ProposalRowFilter = (proposalsTable: typeof proposals) => SQL;

/**
 * The phase a develop phase develops from: the phase before it. A develop
 * phase that opens the process has none.
 */
export function getDevelopOriginPhaseId({
  phases,
  developPhaseId,
}: {
  phases: readonly PhaseInstanceData[];
  developPhaseId: string;
}): string | undefined {
  const developIndex = phases.findIndex(
    (phase) => phase.phaseId === developPhaseId,
  );
  return developIndex > 0 ? phases[developIndex - 1]?.phaseId : undefined;
}

/**
 * Origins assigned to `reviewerProfileId` in the origin phase. Any live
 * assignment counts, whatever its status: a develop holder is assigned like a
 * reviewer but may never complete a review.
 */
export function assignedOriginFilter({
  processInstanceId,
  originPhaseId,
  reviewerProfileId,
}: {
  processInstanceId: string;
  originPhaseId: string;
  reviewerProfileId: string;
}): ProposalRowFilter {
  return (proposalsTable) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(proposalReviewAssignments)
        .where(
          and(
            eq(proposalReviewAssignments.processInstanceId, processInstanceId),
            eq(proposalReviewAssignments.proposalId, proposalsTable.id),
            eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
            eq(proposalReviewAssignments.phaseId, originPhaseId),
            isNull(proposalReviewAssignments.deletedAt),
          ),
        ),
    );
}

/**
 * The sources a caller may develop from: any for an admin, otherwise only the
 * origins assigned to the caller, as `listDevelopOrigins` lists them under
 * `assigned`. Returns null when nothing narrows the sources.
 */
export async function getDevelopSourceFilter({
  processInstanceId,
  phases,
  developPhaseId,
  isAdmin,
  user,
}: {
  processInstanceId: string;
  phases: readonly PhaseInstanceData[];
  developPhaseId: string;
  isAdmin: boolean;
  user: AccessUser;
}): Promise<ProposalRowFilter | null> {
  if (isAdmin) {
    return null;
  }

  const originPhaseId = getDevelopOriginPhaseId({ phases, developPhaseId });
  if (!originPhaseId) {
    return () => sql`false`;
  }

  return assignedOriginFilter({
    processInstanceId,
    originPhaseId,
    reviewerProfileId: await getCallerProfileId(user),
  });
}

export async function getCallerProfileId(user: AccessUser): Promise<string> {
  const { profileId } = await assertUserByAuthId(user.id);
  if (!profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }
  return profileId;
}
