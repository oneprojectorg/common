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

describe.concurrent('requestRevision', () => {
  it('creates a revision request and sets assignment to awaiting revision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Needs Budget Detail',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.requestRevision({
      assignmentId: created.assignment.id,
      requestComment: 'Please add a detailed budget breakdown.',
    });

    expect(result).toMatchObject({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.REQUESTED,
      requestComment: 'Please add a detailed budget breakdown.',
    });
    expect(result.requestedAt).toBeTruthy();

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).toBe(
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    );
  });

  it('rejects when a revision is already pending', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Already Awaiting',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'First request',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.requestRevision({
        assignmentId: created.assignment.id,
        requestComment: 'Second request',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('rejects when the assignment is already completed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Already Done',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.requestRevision({
        assignmentId: created.assignment.id,
        requestComment: 'Too late',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('allows a new revision request after cancelling a previous one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Cancel Then Re-request',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    const firstRequest = await reviewerCaller.decision.requestRevision({
      assignmentId: created.assignment.id,
      requestComment: 'Please add budget details.',
    });
    expect(firstRequest.state).toBe(ProposalReviewRequestState.REQUESTED);

    await reviewerCaller.decision.cancelRevisionRequest({
      assignmentId: created.assignment.id,
      revisionRequestId: firstRequest.id,
    });

    const secondRequest = await reviewerCaller.decision.requestRevision({
      assignmentId: created.assignment.id,
      requestComment: 'Actually, please also add a timeline.',
    });

    expect(secondRequest).toMatchObject({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.REQUESTED,
      requestComment: 'Actually, please also add a timeline.',
    });
    expect(secondRequest.id).not.toBe(firstRequest.id);

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).toBe(
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    );
  });

  it('rejects access for a different reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Not My Assignment',
    });
    const otherReviewer = await testData.createReviewer(created.context);

    const otherCaller = await createAuthenticatedCaller(otherReviewer.email);

    await expect(
      otherCaller.decision.requestRevision({
        assignmentId: created.assignment.id,
        requestComment: 'Should not work',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});
