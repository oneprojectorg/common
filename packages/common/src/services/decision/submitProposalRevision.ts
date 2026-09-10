import { trackRevisionResponseSubmitted } from '@op/analytics';
import { getTipTapClient } from '@op/collab';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  proposalReviewAssignments,
  proposalReviewRequests,
  proposals,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import { and, eq, inArray, sql } from 'drizzle-orm';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertUserByAuthId } from '../assert';
import { parseProposalData } from './proposalDataSchema';
import {
  evictPriorProposalVersionCache,
  findOpenProposalHistoryId,
} from './proposalRevisionHelpers';
import { isInstanceCurrentPhase } from './utils/instance';

export interface SubmitProposalRevisionResult {
  items: Array<ProposalReviewRequest>;
  assignmentIds: Array<string>;
  processInstanceId: string;
  proposalHistoryId: string;
}

/**
 * Resubmits a proposal once, answering every revision request open on it.
 *
 * The unit of a resubmission is the proposal, not one reviewer's request: an
 * author writes one note, and every request open at that moment is answered by
 * it (they share `responseComment`, `respondedAt` and
 * `respondedProposalHistoryId`, which is what groups them into one author
 * note). Requests carried over from an earlier phase are left open — nobody
 * can act on them any more — rather than silently resolved.
 */
export async function submitProposalRevision({
  proposalId,
  note,
  user,
}: {
  proposalId: string;
  note: string;
  user: User;
}): Promise<SubmitProposalRevisionResult> {
  const [proposal, dbUser] = await Promise.all([
    db.query.proposals.findFirst({
      where: { id: proposalId },
      with: {
        processInstance: true,
        reviewAssignments: {
          with: {
            requests: {
              where: { state: ProposalReviewRequestState.REQUESTED },
            },
          },
        },
      },
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (proposal.submittedByProfileId !== dbUser.profileId) {
    throw new UnauthorizedError(
      "You don't have access to resubmit this proposal",
    );
  }

  const trimmedNote = note.trim();

  if (trimmedNote.length === 0) {
    throw new ValidationError('A note for reviewers is required');
  }

  const instance = proposal.processInstance;

  const assignmentsWithOpenRequests = proposal.reviewAssignments.filter(
    (assignment) => assignment.requests.length > 0,
  );
  const answerableAssignments = assignmentsWithOpenRequests.filter(
    (assignment) => isInstanceCurrentPhase(instance, assignment.phaseId),
  );

  const pastPhaseCount =
    assignmentsWithOpenRequests.length - answerableAssignments.length;

  if (pastPhaseCount > 0) {
    // A past-phase request can no longer be re-reviewed, so answering it would
    // strand its assignment. It stays open and visible instead.
    logger.warn('Revision requests from an earlier phase left unanswered', {
      proposalId,
      assignmentCount: pastPhaseCount,
    });
  }

  if (answerableAssignments.length === 0) {
    throw new ValidationError(
      'This proposal has no open revision requests to answer',
    );
  }

  const assignmentIds = answerableAssignments.map(
    (assignment) => assignment.id,
  );
  const requestIds = answerableAssignments.flatMap((assignment) =>
    assignment.requests.map((request) => request.id),
  );

  const proposalData = parseProposalData(proposal.proposalData);

  if (!proposalData.collaborationDocId) {
    throw new ValidationError('Proposal is missing a collaboration document');
  }

  const collaborationDocVersionId = await getTipTapClient()
    .createVersion(proposalData.collaborationDocId, {
      name: 'Resubmitted',
      meta: {
        eventType: 'proposal_revision_submitted',
        proposalId,
      },
    })
    .then((version) => version?.version ?? null);

  if (collaborationDocVersionId == null) {
    throw new CommonError(
      'We could not submit your revision right now. Please try again.',
    );
  }

  const now = new Date().toISOString();

  const { items, proposalHistoryId } = await db.transaction(async (tx) => {
    // Serializes two resubmissions of the same proposal, so a concurrent pair
    // cannot each write a version and split one answer across two snapshots.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${'proposal_revision:' + proposalId}))`,
    );

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
      throw new CommonError('Failed to update proposal for the revision');
    }

    const historyId = await findOpenProposalHistoryId(tx, proposal.id);

    // The state guard repeats the read-side check inside the write: a request
    // answered between the read and here is not answered twice, and a caller
    // that raced away every open request rolls the whole resubmission back.
    const updatedRequests = await tx
      .update(proposalReviewRequests)
      .set({
        state: ProposalReviewRequestState.RESUBMITTED,
        respondedAt: now,
        responseComment: trimmedNote,
        respondedProposalHistoryId: historyId,
      })
      .where(
        and(
          inArray(proposalReviewRequests.id, requestIds),
          eq(
            proposalReviewRequests.state,
            ProposalReviewRequestState.REQUESTED,
          ),
        ),
      )
      .returning();

    if (updatedRequests.length === 0) {
      throw new ValidationError(
        'This proposal has no open revision requests to answer',
      );
    }

    // Re-anchor every touched assignment to the new snapshot. The pin records
    // the version the assignment was handed; it feeds the staleness signal and
    // the admin views, not what the reviewer pane renders.
    await tx
      .update(proposalReviewAssignments)
      .set({
        assignedProposalHistoryId: historyId,
      })
      .where(inArray(proposalReviewAssignments.id, assignmentIds));

    // Only assignments this revision cycle paused resume. A COMPLETED
    // assignment keeps its status — the reviewer already submitted, and the
    // derived out-of-date flag tells them their review predates this version.
    await tx
      .update(proposalReviewAssignments)
      .set({
        status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
      })
      .where(
        and(
          inArray(proposalReviewAssignments.id, assignmentIds),
          eq(
            proposalReviewAssignments.status,
            ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
          ),
        ),
      );

    return { items: updatedRequests, proposalHistoryId: historyId };
  });

  await evictPriorProposalVersionCache({
    collaborationDocId: proposalData.collaborationDocId,
    instance,
    priorVersionId: proposalData.collaborationDocVersionId,
  });

  waitUntil(
    trackRevisionResponseSubmitted(
      user.id,
      proposal.processInstanceId,
      proposal.id,
      {
        request_count: items.length,
      },
    ),
  );

  return {
    items,
    assignmentIds,
    processInstanceId: proposal.processInstanceId,
    proposalHistoryId,
  };
}
