import { and, count, db, eq, inArray, isNull, sql } from '@op/db/client';
import {
  ProposalReviewState,
  profiles,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import { getEligibleReviewerProfileIds } from './getEligibleReviewerProfileIds';
import { getInstance } from './getInstance';
import {
  type PhaseReviewerSummaries,
  phaseReviewerSummariesSchema,
} from './schemas/adminDecisionInstance';
import type { InstancePhaseRef } from './schemas/instance';
import { assertInstancePhase } from './utils/instance';

/** Per-reviewer progress, aggregated in SQL: this screen renders no rows. */
export async function listPhaseReviewerSummaries({
  user,
  processInstanceId,
  phaseId,
}: InstancePhaseRef & { user: User }): Promise<PhaseReviewerSummaries> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  const rollups = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      slug: profiles.slug,
      email: profiles.email,
      assignedCount: count(proposalReviewAssignments.id),
      submittedCount:
        sql<number>`count(*) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED})`.mapWith(
          Number,
        ),
      draftCount:
        sql<number>`count(*) filter (where ${proposalReviews.state} = ${ProposalReviewState.DRAFT})`.mapWith(
          Number,
        ),
      lastSubmittedAt: sql<
        string | null
      >`max(${proposalReviews.submittedAt}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED})`,
    })
    .from(proposalReviewAssignments)
    .innerJoin(
      profiles,
      eq(profiles.id, proposalReviewAssignments.reviewerProfileId),
    )
    // Unreachable even to admins (see detachProposalForModeration);
    // assignments made before the detach would otherwise leak it.
    .innerJoin(
      proposals,
      eq(proposals.id, proposalReviewAssignments.proposalId),
    )
    .leftJoin(
      proposalReviews,
      eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
    )
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        eq(proposalReviewAssignments.phaseId, phaseId),
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    )
    .groupBy(profiles.id, profiles.name, profiles.slug, profiles.email)
    // Heaviest queue first; the table is scanned for workload.
    .orderBy(sql`count(${proposalReviewAssignments.id}) desc`, profiles.name);

  const rolledUpIds = new Set(rollups.map((row) => row.id));
  const eligibleProfileIds = instance.profileId
    ? await getEligibleReviewerProfileIds({
        decisionProfileId: instance.profileId,
      })
    : [];
  const idleIds = eligibleProfileIds.filter((id) => !rolledUpIds.has(id));

  // Reviewers holding the role but carrying nothing still get a row.
  const idleReviewers =
    idleIds.length > 0
      ? await db
          .select({
            id: profiles.id,
            name: profiles.name,
            slug: profiles.slug,
            email: profiles.email,
          })
          .from(profiles)
          .where(inArray(profiles.id, idleIds))
          .orderBy(profiles.name)
      : [];

  // Every rollup carries at least one assignment and every idle reviewer
  // none, so the two ordered queries concatenate into one assigned-desc list.
  const reviewers = [
    ...rollups.map((row) => ({
      profile: { id: row.id, name: row.name, slug: row.slug },
      email: row.email,
      assignedCount: row.assignedCount,
      submittedCount: row.submittedCount,
      draftCount: row.draftCount,
      lastSubmittedAt: row.lastSubmittedAt,
    })),
    ...idleReviewers.map((row) => ({
      profile: { id: row.id, name: row.name, slug: row.slug },
      email: row.email,
      assignedCount: 0,
      submittedCount: 0,
      draftCount: 0,
      lastSubmittedAt: null,
    })),
  ];

  return phaseReviewerSummariesSchema.parse({
    reviewers,
    totalAssignments: rollups.reduce((sum, row) => sum + row.assignedCount, 0),
  });
}
