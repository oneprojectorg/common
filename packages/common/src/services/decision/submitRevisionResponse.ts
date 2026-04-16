import { getTipTapClient } from '@op/collab';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  proposalHistory,
  proposalReviewAssignments,
  proposalReviewRequests,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { and, eq, sql } from 'drizzle-orm';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertUserByAuthId } from '../assert';
import { parseProposalData } from './proposalDataSchema';

/** Resubmits a proposal after the author addresses reviewer feedback. */
export async function submitRevisionResponse({
  revisionRequestId,
  resubmitComment,
  user,
}: {
  revisionRequestId: string;
  resubmitComment?: string;
  user: User;
}): Promise<ProposalReviewRequest & { processInstanceId: string }> {
  const [request, dbUser] = await Promise.all([
    db.query.proposalReviewRequests.findFirst({
      where: { id: revisionRequestId },
      with: {
        assignment: {
          with: {
            proposal: true,
          },
        },
      },
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!request) {
    throw new NotFoundError('Revision request');
  }

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposal = request.assignment.proposal;

  // Verify caller is the proposal owner
  if (proposal.submittedByProfileId !== dbUser.profileId) {
    throw new UnauthorizedError(
      "You don't have access to resubmit this proposal",
    );
  }

  // Verify the revision request is in REQUESTED state
  if (request.state !== ProposalReviewRequestState.REQUESTED) {
    throw new ValidationError(
      'Only active revision requests can be resubmitted',
    );
  }

  if (
    request.assignment.status !==
    ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION
  ) {
    throw new ValidationError(
      'Only assignments awaiting author revision can be resubmitted',
    );
  }

  const normalizedResubmitComment = resubmitComment?.trim() || null;
  const proposalData = parseProposalData(proposal.proposalData);

  if (!proposalData.collaborationDocId) {
    throw new ValidationError('Proposal is missing a collaboration document');
  }

  const collaborationDocVersionId = await getTipTapClient()
    .createVersion(proposalData.collaborationDocId, {
      name: 'Resubmitted',
      meta: {
        eventType: 'revision_response_submitted',
        revisionRequestId,
      },
    })
    .then((version) => version?.version ?? null);

  if (collaborationDocVersionId == null) {
    throw new CommonError(
      'We could not submit your revision response right now. Please try again.',
    );
  }

  const now = new Date().toISOString();

  const updatedRequest = await db.transaction(async (tx) => {
    const proposalDataWithVersion = {
      ...(proposal.proposalData as Record<string, unknown>),
      collaborationDocVersionId,
    };

    const [updatedProposal] = await tx
      .update(proposals)
      .set({
        proposalData: proposalDataWithVersion,
        updatedAt: now,
      })
      .where(eq(proposals.id, proposal.id))
      .returning();

    if (!updatedProposal) {
      throw new CommonError('Failed to update proposal for revision response');
    }

    // The AFTER UPDATE trigger on decision_proposals automatically creates a
    // history snapshot with the post-update state. Find that row.
    const [historyRecord] = await tx
      .select({ historyId: proposalHistory.historyId })
      .from(proposalHistory)
      .where(
        and(
          eq(proposalHistory.id, proposal.id),
          sql`upper(${proposalHistory.validDuring}) IS NULL`,
        ),
      )
      .limit(1);

    if (!historyRecord) {
      throw new CommonError('Failed to find proposal history snapshot');
    }

    // 2. Update revision request: state → RESUBMITTED, set respondedAt, responseComment, respondedProposalHistoryId
    const [resubmittedRequest] = await tx
      .update(proposalReviewRequests)
      .set({
        state: ProposalReviewRequestState.RESUBMITTED,
        respondedAt: now,
        responseComment: normalizedResubmitComment,
        respondedProposalHistoryId: historyRecord.historyId,
      })
      .where(eq(proposalReviewRequests.id, revisionRequestId))
      .returning();

    if (!resubmittedRequest) {
      throw new CommonError('Failed to update revision request');
    }

    // 3. Update assignment status → READY_FOR_RE_REVIEW
    await tx
      .update(proposalReviewAssignments)
      .set({
        status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
      })
      .where(eq(proposalReviewAssignments.id, request.assignmentId));

    return resubmittedRequest;
  });

  return {
    ...updatedRequest,
    processInstanceId: request.assignment.processInstanceId,
  };
}
