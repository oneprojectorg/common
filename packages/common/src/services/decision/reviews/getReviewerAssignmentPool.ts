import { aliasedTable, db, eq, inArray } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../../access';
import { getEligibleReviewerProfileIds } from '../getEligibleReviewerProfileIds';
import { getInstance } from '../getInstance';
import { getProposalIdsForPhase } from '../getProposalsForPhase';
import { getCategoriesByProposalIds } from '../listProposalsWithReviewAggregates';
import { resolveProposalTitle } from './resolveProposalTitle';
import {
  type ReviewerAssignmentPool,
  reviewerAssignmentPoolSchema,
} from '../schemas/reviewAssignments';
import type { InstancePhaseRef } from '../schemas/instance';
import { assertInstancePhase } from '../utils/instance';

/** The manage dialog's pick list: phase proposals + this reviewer's rows. */
export async function getReviewerAssignmentPool({
  user,
  processInstanceId,
  phaseId,
  reviewerProfileId,
}: InstancePhaseRef & {
  user: User;
  reviewerProfileId: string;
}): Promise<ReviewerAssignmentPool> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  const [reviewer, assignments, phaseProposalIds, eligibleProfileIds] =
    await Promise.all([
      db.query.profiles.findFirst({
        where: { id: reviewerProfileId },
        columns: { id: true, name: true, slug: true, email: true },
      }),
      db.query.proposalReviewAssignments.findMany({
        where: {
          processInstanceId,
          phaseId,
          reviewerProfileId,
          proposal: {
            deletedAt: { isNull: true },
            moderationDetachedAt: { isNull: true },
          },
        },
        columns: { id: true, proposalId: true, status: true },
        with: { reviews: { columns: { state: true } } },
        orderBy: { assignedAt: 'asc' },
      }),
      // A plain status filter would miss snapshot-attached proposals.
      getProposalIdsForPhase({ instance, phaseId }),
      instance.profileId
        ? getEligibleReviewerProfileIds({
            decisionProfileId: instance.profileId,
          })
        : Promise.resolve<string[]>([]),
    ]);

  const proposalProfiles = aliasedTable(profiles, 'proposal_profiles');
  const [pool, categoriesByProposalId] = await Promise.all([
    phaseProposalIds.length > 0
      ? db
          .select({
            id: proposals.id,
            proposalData: proposals.proposalData,
            profileName: proposalProfiles.name,
            submittedByProfileId: proposals.submittedByProfileId,
            authorId: profiles.id,
            authorName: profiles.name,
            authorSlug: profiles.slug,
          })
          .from(proposals)
          .leftJoin(profiles, eq(proposals.submittedByProfileId, profiles.id))
          .leftJoin(
            proposalProfiles,
            eq(proposals.profileId, proposalProfiles.id),
          )
          .where(inArray(proposals.id, phaseProposalIds))
      : Promise.resolve([]),
    getCategoriesByProposalIds(phaseProposalIds),
  ]);

  // Identity only for a profile this process touches — see getReviewerAssignments.
  const isEligible = eligibleProfileIds.includes(reviewerProfileId);
  const isAssociated = isEligible || assignments.length > 0;

  return reviewerAssignmentPoolSchema.parse({
    reviewer: isAssociated ? (reviewer ?? null) : null,
    isEligible,
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      proposalId: assignment.proposalId,
      status: assignment.status,
      // assignmentId is UNIQUE on reviews, so there is 0 or 1 row.
      reviewState: assignment.reviews[0]?.state ?? null,
    })),
    proposals: pool.map((proposal) => ({
      id: proposal.id,
      title: resolveProposalTitle(proposal.profileName, proposal.proposalData),
      submittedByProfileId: proposal.submittedByProfileId,
      categories: categoriesByProposalId.get(proposal.id) ?? [],
      author: proposal.authorId
        ? {
            id: proposal.authorId,
            name: proposal.authorName,
            slug: proposal.authorSlug,
          }
        : null,
    })),
  });
}
