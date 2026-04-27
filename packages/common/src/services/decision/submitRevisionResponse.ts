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
import { assertAccess, permission } from 'access-zones';
import { and, eq, sql } from 'drizzle-orm';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { decisionPermission } from './permissions';
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
  const request = await db.query.proposalReviewRequests.findFirst({
    where: { id: revisionRequestId },
    with: {
      assignment: {
        with: {
          proposal: {
            with: {
              processInstance: true,
            },
          },
        },
      },
    },
  });

  if (!request) {
    throw new NotFoundError('Revision request');
  }

  const proposal = request.assignment.proposal;
  const instance = proposal.processInstance;

  // Authorization: owner (individual or org), co-author, or instance admin.
  const [rolesOnOwner, rolesOnProposal, rolesOnInstance] = await Promise.all([
    getProfileAccessUser({
      user: { id: user.id },
      profileId: proposal.submittedByProfileId,
    }).then((pu) => pu?.roles ?? []),
    getProfileAccessUser({
      user: { id: user.id },
      profileId: proposal.profileId,
    }).then((pu) => pu?.roles ?? []),
    instance?.profileId
      ? getProfileAccessUser({
          user: { id: user.id },
          profileId: instance.profileId,
        }).then((pu) => pu?.roles ?? [])
      : Promise.resolve([]),
  ]);

  assertAccess(
    [
      { profile: permission.ADMIN },
      { decisions: decisionPermission.SUBMIT_PROPOSALS },
    ],
    [...rolesOnOwner, ...rolesOnProposal, ...rolesOnInstance],
  );

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
