import {
  type SQL,
  and,
  db,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalRelationshipType,
  categoryReviewers,
  proposalCategories,
  proposalRelationships,
  proposalReviewAssignments,
  proposals,
} from '@op/db/schema';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import type { AccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import { getProposalDevelopAccess } from './assertProposalDevelopAccess';
import type { PhaseScopedInstance } from './getProposalsForPhase';
import { listProposals } from './listProposals';
import { getOwnDevelopedEntryScope } from './ownDevelopedEntryScope';
import type {
  DevelopOriginEntry,
  DevelopOriginList,
  DevelopOriginScope,
  ListDevelopOriginsInput,
} from './schemas/developOrigins';
import { getInstancePhases } from './schemas/instanceData';

/**
 * The origins of the current develop phase: proposals of the phase before it
 * that the caller may develop into entries, narrowed by `scope` and
 * `categoryId`. A develop holder may ask for `assigned` or `categories`; only
 * an admin may ask for `all`. The rows, order and cursor are `listProposals`',
 * so the result reads like any proposal list. Each page also carries the
 * caller's own entry for each of its origins that has one.
 */
export async function listDevelopOrigins({
  input,
  user,
}: {
  input: ListDevelopOriginsInput;
  user: AccessUser;
}): Promise<DevelopOriginList> {
  const { processInstanceId, scope = 'assigned', categoryId } = input;

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      instanceData: true,
      currentStateId: true,
    },
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
    return {
      items: [],
      total: 0,
      canManageProposals: isAdmin,
      next: null,
      ownEntries: [],
    };
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

  const page = await listProposals({
    input: {
      processInstanceId,
      phaseId: originPhaseId,
      categoryId,
      search: input.search,
      restrictTo,
      cursor: input.cursor,
      limit: input.limit,
      dir: input.dir,
    },
    user,
  });

  const ownEntries = await listOwnEntriesForOrigins({
    instance,
    processInstanceId,
    authUserId: user.id,
    originIds: page.items.map((origin) => origin.id),
  });

  return { ...page, ownEntries };
}

/**
 * The caller's newest own entry of the current phase developed from each of
 * the given origins, one row per origin that has one.
 */
async function listOwnEntriesForOrigins({
  instance,
  processInstanceId,
  authUserId,
  originIds,
}: {
  instance: PhaseScopedInstance;
  processInstanceId: string;
  authUserId: string;
  originIds: string[];
}): Promise<DevelopOriginEntry[]> {
  if (originIds.length === 0) {
    return [];
  }

  const scope = await getOwnDevelopedEntryScope({
    instance,
    processInstanceId,
    authUserId,
  });

  if (scope.isEmpty) {
    return [];
  }

  return db
    .selectDistinctOn([proposalRelationships.sourceProposalId], {
      originId: proposalRelationships.sourceProposalId,
      id: proposals.id,
      profileId: proposals.profileId,
      status: proposals.status,
    })
    .from(proposalRelationships)
    .innerJoin(
      proposals,
      eq(proposals.id, proposalRelationships.targetProposalId),
    )
    .where(
      and(
        inArray(proposalRelationships.sourceProposalId, originIds),
        eq(
          proposalRelationships.relationshipType,
          ProposalRelationshipType.DEVELOPED,
        ),
        isNull(proposalRelationships.deletedAt),
        scope.buildFilter(proposals),
      ),
    )
    .orderBy(
      proposalRelationships.sourceProposalId,
      desc(proposals.createdAt),
      desc(proposals.id),
    );
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
