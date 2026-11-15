import { type SQL, and, db, eq, exists, isNull, or, sql } from '@op/db/client';
import {
  categoryReviewers,
  proposalCategories,
  proposalReviewAssignments,
  type proposals,
} from '@op/db/schema';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import type { AccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { getProposalDevelopAccess } from './assertProposalDevelopAccess';
import { listProposals } from './listProposals';
import type {
  DevelopOriginScope,
  ListDevelopOriginsInput,
} from './schemas/developOrigins';
import { getInstancePhases } from './schemas/instanceData';

/**
 * The origins of the current develop phase: proposals of the phase before it
 * that the caller may develop into entries, narrowed by `scope` and
 * `categoryId`. A develop holder may ask for `assigned` or `categories`; only
 * an admin may ask for `all`. The rows, order and cursor are `listProposals`',
 * so the result reads like any proposal list.
 */
export async function listDevelopOrigins({
  input,
  user,
}: {
  input: ListDevelopOriginsInput;
  user: AccessUser;
}) {
  const { processInstanceId, scope = 'assigned', categoryId } = input;

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true, instanceData: true, currentStateId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.currentStateId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  const phases = getInstancePhases(instance.instanceData);
  const developPhaseId = instance.currentStateId;

  const { isAdmin, canDevelop } = await getProposalDevelopAccess({
    instance: { profileId: instance.profileId, instanceData: { phases } },
    phaseId: developPhaseId,
    user,
  });

  if (!canDevelop || (scope === 'all' && !isAdmin)) {
    throw new UnauthorizedError('Not authorized');
  }

  const developIndex = phases.findIndex(
    (phase) => phase.phaseId === developPhaseId,
  );
  const originPhaseId = phases[developIndex - 1]?.phaseId;

  // A develop phase that opens the process has nothing to develop from.
  if (!originPhaseId) {
    return { items: [], total: 0, canManageProposals: isAdmin, next: null };
  }

  const restrictTo =
    scope === 'all'
      ? undefined
      : buildScopeFilter({
          scope,
          processInstanceId,
          originPhaseId,
          developPhaseId,
          reviewerProfileId: await getCallerProfileId(user),
        });

  return listProposals({
    input: {
      processInstanceId,
      phaseId: originPhaseId,
      categoryId,
      restrictTo,
      cursor: input.cursor,
      limit: input.limit,
      dir: input.dir,
    },
    user,
  });
}

async function getCallerProfileId(user: AccessUser): Promise<string> {
  const { profileId } = await assertUserByAuthId(user.id);
  if (!profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }
  return profileId;
}

/**
 * The scope as a correlated predicate on the proposal row, so it rides in the
 * list's own WHERE clause and keeps its order, cursor and total true.
 */
function buildScopeFilter({
  scope,
  processInstanceId,
  originPhaseId,
  developPhaseId,
  reviewerProfileId,
}: {
  scope: Exclude<DevelopOriginScope, 'all'>;
  processInstanceId: string;
  originPhaseId: string;
  developPhaseId: string;
  reviewerProfileId: string;
}): (proposalsTable: typeof proposals) => SQL {
  if (scope === 'assigned') {
    // Any live assignment counts, whatever its status: a develop holder is
    // assigned like a reviewer but may never complete a review.
    return (proposalsTable) =>
      exists(
        db
          .select({ one: sql`1` })
          .from(proposalReviewAssignments)
          .where(
            and(
              eq(
                proposalReviewAssignments.processInstanceId,
                processInstanceId,
              ),
              eq(proposalReviewAssignments.proposalId, proposalsTable.id),
              eq(
                proposalReviewAssignments.reviewerProfileId,
                reviewerProfileId,
              ),
              eq(proposalReviewAssignments.phaseId, originPhaseId),
              isNull(proposalReviewAssignments.deletedAt),
            ),
          ),
      );
  }

  // Category reviewer rows of the develop phase, plus instance-wide ones.
  return (proposalsTable) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(proposalCategories)
        .innerJoin(
          categoryReviewers,
          eq(
            categoryReviewers.taxonomyTermId,
            proposalCategories.taxonomyTermId,
          ),
        )
        .where(
          and(
            eq(proposalCategories.proposalId, proposalsTable.id),
            eq(categoryReviewers.processInstanceId, processInstanceId),
            eq(categoryReviewers.reviewerProfileId, reviewerProfileId),
            or(
              isNull(categoryReviewers.phaseId),
              eq(categoryReviewers.phaseId, developPhaseId),
            ),
          ),
        ),
    );
}
