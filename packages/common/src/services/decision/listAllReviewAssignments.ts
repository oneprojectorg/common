import { db } from '@op/db/client';
import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import {
  getActiveRevisionRequest,
  resolveAssignmentProposal,
  reviewAssignmentWithConfig,
} from './reviewHelpers';
import { type ReviewItemList, reviewItemListSchema } from './schemas/reviews';

/**
 * Admin-scoped endpoint that returns every review assignment in a process
 * instance without the heavy TipTap payload (document/html/template/attachments).
 *
 * Callers pair this with `listProposals` or `listReviewAssignments` when they
 * need proposal bodies.
 */
export async function listAllReviewAssignments({
  processInstanceId,
  status,
  dir = 'asc',
  user,
}: {
  processInstanceId: string;
  status?: ProposalReviewAssignmentStatus;
  dir?: 'asc' | 'desc';
  user: User;
}): Promise<ReviewItemList> {
  const [instance, dbUser] = await Promise.all([
    getInstance({ instanceId: processInstanceId, user }),
    assertUserByAuthId(user.id),
  ]);

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance.access.admin) {
    throw new UnauthorizedError(
      "You don't have admin access to this process instance",
    );
  }

  const assignments = await db.query.proposalReviewAssignments.findMany({
    where: {
      processInstanceId,
      ...(status && { status }),
    },
    with: reviewAssignmentWithConfig,
    orderBy: {
      assignedAt: dir,
    },
  });

  const rubricTemplate = instance.instanceData.rubricTemplate ?? null;

  const items = assignments.map((assignment) => {
    const proposalSnapshot = resolveAssignmentProposal(assignment);

    return {
      assignment: {
        id: assignment.id,
        processInstanceId: assignment.processInstanceId,
        phaseId: assignment.phaseId,
        status: assignment.status,
        reviewer: assignment.reviewer,
        proposal: proposalSnapshot,
      },
      review: assignment.reviews[0] ?? null,
      revisionRequest: getActiveRevisionRequest(assignment.requests),
    };
  });

  return reviewItemListSchema.parse({
    items,
    rubricTemplate,
  });
}
