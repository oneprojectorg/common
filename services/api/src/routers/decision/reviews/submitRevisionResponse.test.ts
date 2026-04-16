import { getTipTapClient } from '@op/collab';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createRevisionRequest } from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('submitRevisionResponse', () => {
  it('resubmits a proposal and transitions states correctly', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Garden Expansion',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please add budget details.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.submitRevisionResponse({
      revisionRequestId: revisionRequest.id,
      resubmitComment: 'Added detailed budget breakdown.',
    });

    expect(result).toMatchObject({
      id: revisionRequest.id,
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      responseComment: 'Added detailed budget breakdown.',
    });
    expect(result.respondedAt).toBeTruthy();

    // Assignment should be READY_FOR_RE_REVIEW
    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).toBe(
      ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    );

    // Revision request should have a respondedProposalHistoryId
    const updatedRequest = await db.query.proposalReviewRequests.findFirst({
      where: { id: revisionRequest.id },
    });
    expect(updatedRequest?.respondedProposalHistoryId).toBeTruthy();

    const snapshot = updatedRequest?.respondedProposalHistoryId
      ? await db.query.proposalHistory.findFirst({
          where: { historyId: updatedRequest.respondedProposalHistoryId },
        })
      : null;

    expect(snapshot).toMatchObject({
      id: created.proposal.id,
      status: created.proposal.status,
    });

    const versionId = (snapshot?.proposalData as Record<string, unknown> | null)
      ?.collaborationDocVersionId;

    expect(versionId).toBeTypeOf('number');

    const updatedProposal = await db.query.proposals.findFirst({
      where: { id: created.proposal.id },
    });

    expect(updatedProposal?.proposalData).toMatchObject({
      collaborationDocVersionId: versionId,
    });

    const versions = await getTipTapClient().listVersions(
      (created.proposal.proposalData as Record<string, unknown>)
        .collaborationDocId as string,
    );
    const latestVersion = versions.reduce((latest, version) =>
      version.version > latest.version ? version : latest,
    );

    expect(latestVersion).toMatchObject({
      name: 'Resubmitted',
      meta: {
        eventType: 'revision_response_submitted',
        revisionRequestId: revisionRequest.id,
      },
    });
  });

  it('rejects when the assignment is not awaiting author revision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Drifted Assignment State',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.submitRevisionResponse({
        revisionRequestId: revisionRequest.id,
        resubmitComment: 'Updated as requested.',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('stores null when the resubmit comment is omitted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'No Comment Resubmission',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.submitRevisionResponse({
      revisionRequestId: revisionRequest.id,
    });

    expect(result.responseComment).toBeNull();

    const updatedRequest = await db.query.proposalReviewRequests.findFirst({
      where: { id: revisionRequest.id },
    });

    expect(updatedRequest?.responseComment).toBeNull();
  });

  it('rejects when the revision request is not in requested state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Already Resubmitted',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.RESUBMITTED,
      requestComment: 'Already handled.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.submitRevisionResponse({
        revisionRequestId: revisionRequest.id,
        resubmitComment: 'Trying again.',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('rejects when the caller is not the proposal owner', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Not My Proposal',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    // The reviewer is not the proposal owner
    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitRevisionResponse({
        revisionRequestId: revisionRequest.id,
        resubmitComment: 'Should not work.',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('rejects when the revision request does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'No Request',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.submitRevisionResponse({
        revisionRequestId: '00000000-0000-0000-0000-000000000000',
        resubmitComment: 'Nothing to resubmit.',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });
});
