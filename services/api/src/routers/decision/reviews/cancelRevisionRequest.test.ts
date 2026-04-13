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

describe.concurrent('cancelRevisionRequest', () => {
  it('cancels a revision request and resumes the assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Cancel This Revision',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.cancelRevisionRequest({
      assignmentId: created.assignment.id,
      revisionRequestId: revisionRequest.id,
    });

    expect(result).toMatchObject({
      id: revisionRequest.id,
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.CANCELLED,
    });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.IN_PROGRESS);
  });

  it('rejects when the revision request is not in requested state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Already Cancelled',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.CANCELLED,
      requestComment: 'Already cancelled.',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.cancelRevisionRequest({
        assignmentId: created.assignment.id,
        revisionRequestId: revisionRequest.id,
      }),
    ).rejects.toThrow('Only active revision requests can be cancelled');
  });

  it('rejects when the revision request does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'No Request',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.cancelRevisionRequest({
        assignmentId: created.assignment.id,
        revisionRequestId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });

  it('rejects access for a different reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Not My Assignment',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    const otherReviewer = await testData.createReviewer(created.context);
    const otherCaller = await createAuthenticatedCaller(otherReviewer.email);

    await expect(
      otherCaller.decision.cancelRevisionRequest({
        assignmentId: created.assignment.id,
        revisionRequestId: revisionRequest.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});
